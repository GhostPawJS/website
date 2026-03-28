// ---------------------------------------------------------------------------
// Fitness runner — assembles context, runs all applicable analyzers,
// computes scores, and builds the final FitnessReport.
// ---------------------------------------------------------------------------

import type {
	CannibalizationPair,
	DimensionScore,
	FitnessReport,
	GscData,
	Issue,
	ProjectPaths,
	RenderedPage,
	SiteConfig,
	TopicalCluster,
} from '../types.ts';
import { buildSiteContext } from './context.ts';
import { ANALYZERS } from './registry.ts';
import { computeDimensionScore, computeOverallScore, computePageScores } from './score.ts';
import { getCosineSimilarity } from './tfidf.ts';
import type { SiteContext } from './types.ts';

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Run the complete fitness pipeline on a set of rendered pages.
 *
 * 1. Builds a SiteContext (TF-IDF, link graph, domain/persona, etc.)
 * 2. Runs all applicable analyzers synchronously
 * 3. Aggregates results into dimension scores, page scores, clusters
 * 4. Returns a FitnessReport
 */
export async function fitness(
	pages: RenderedPage[],
	config: SiteConfig,
	paths: ProjectPaths,
	searchConsole?: GscData,
): Promise<FitnessReport> {
	const ctx = await buildSiteContext(pages, config, paths, searchConsole);

	// --- Run analyzers ---
	const dimensionResults = new Map<
		string,
		{ results: ReturnType<(typeof ANALYZERS)[0]['analyze']>; weight: number }
	>();

	for (const analyzer of ANALYZERS) {
		if (!analyzer.applies(ctx)) continue;

		const results = analyzer.analyze(ctx);
		const existing = dimensionResults.get(analyzer.dimension);
		if (existing) {
			existing.results.push(...results);
		} else {
			dimensionResults.set(analyzer.dimension, { results, weight: analyzer.weight });
		}
	}

	// --- Compute dimension scores ---
	const dimensions: Record<string, DimensionScore> = {};
	const dimensionScoresForOverall: Array<{ score: number; weight: number }> = [];
	const allIssues: Issue[] = [];

	for (const [dim, { results, weight }] of dimensionResults) {
		const ds = computeDimensionScore(results);
		dimensions[dim] = ds;
		dimensionScoresForOverall.push({ score: ds.score, weight });
		allIssues.push(...ds.issues);
	}

	// --- Compute page scores ---
	const pageScores = computePageScores(ctx, allIssues);

	// --- Compute overall score ---
	const overall = computeOverallScore(dimensionScoresForOverall);

	// --- Build topical clusters ---
	const clusters = buildTopicalClusters(ctx);

	// --- Collect cannibalization pairs ---
	const cannibalization = collectCannibalizationPairs(allIssues, ctx);

	return {
		timestamp: Date.now(),
		overall,
		dimensions,
		pages: pageScores,
		clusters,
		cannibalization,
	};
}

// ---------------------------------------------------------------------------
// Topical cluster builder
//
// Re-runs the same union-find as topical_clusters.ts but also computes
// cluster coherence (mean pairwise cosine) and identifies pillar pages
// for the TopicalCluster shape in FitnessReport.
// ---------------------------------------------------------------------------

const CLUSTER_THRESHOLD = 0.25;
const PILLAR_MIN_INCOMING = 2;

export function buildTopicalClusters(ctx: SiteContext): TopicalCluster[] {
	const urls = ctx.pages.map((p) => p.url);
	if (urls.length < 2) return [];

	// Union-Find
	const parent = new Map<string, string>();
	const rank = new Map<string, number>();
	for (const u of urls) {
		parent.set(u, u);
		rank.set(u, 0);
	}

	// Cache all pairwise similarities we need (upper-triangle)
	const pairSims = new Map<string, number>();
	for (let i = 0; i < urls.length; i++) {
		for (let j = i + 1; j < urls.length; j++) {
			const ua = urls[i] as string;
			const ub = urls[j] as string;
			const sim = getCosineSimilarity(ctx.tfidf, ua, ub);
			const key = ua < ub ? `${ua}\0${ub}` : `${ub}\0${ua}`;
			pairSims.set(key, sim);
			if (sim >= CLUSTER_THRESHOLD) {
				ufUnion(parent, rank, ua, ub);
			}
		}
	}

	// Group by cluster root
	const groups = new Map<string, string[]>();
	for (const u of urls) {
		const root = ufFind(parent, u);
		const g = groups.get(root) ?? [];
		g.push(u);
		groups.set(root, g);
	}

	const clusters: TopicalCluster[] = [];
	for (const [root, members] of groups) {
		// Compute mean pairwise cosine (coherence)
		let coherence = 0;
		if (members.length >= 2) {
			let pairs = 0;
			let sumSim = 0;
			for (let i = 0; i < members.length; i++) {
				for (let j = i + 1; j < members.length; j++) {
					const ua = members[i] as string;
					const ub = members[j] as string;
					const key = ua < ub ? `${ua}\0${ub}` : `${ub}\0${ua}`;
					sumSim += pairSims.get(key) ?? 0;
					pairs++;
				}
			}
			coherence = pairs > 0 ? Math.round((sumSim / pairs) * 100) / 100 : 0;
		}

		// Find pillar: page with most incoming internal links
		const withIncoming = members.map((u) => ({
			url: u,
			incoming: ctx.linkGraph.incoming.get(u)?.length ?? 0,
		}));
		withIncoming.sort((a, b) => b.incoming - a.incoming);

		const pillarCandidate = withIncoming[0];
		const pillar =
			pillarCandidate && pillarCandidate.incoming >= PILLAR_MIN_INCOMING
				? pillarCandidate.url
				: undefined;

		const missingPillar = pillar === undefined && members.length >= 3;

		// Orphans: singleton clusters (only member)
		const orphans = members.length === 1 && members[0] !== '/' ? [members[0] as string] : [];

		clusters.push({
			id: root,
			...(pillar ? { pillar } : {}),
			pages: members,
			coherence,
			missingPillar,
			orphans,
		});
	}

	// Sort: largest clusters first
	clusters.sort((a, b) => b.pages.length - a.pages.length);
	return clusters;
}

// ---------------------------------------------------------------------------
// Cannibalization pair extractor
//
// The cannibalization analyzer already computed pairs and embedded the data
// in issue.current as JSON. Parse them back out for the report's top-level
// cannibalization array.
// ---------------------------------------------------------------------------

function collectCannibalizationPairs(issues: Issue[], ctx: SiteContext): CannibalizationPair[] {
	const pairs: CannibalizationPair[] = [];
	const seen = new Set<string>();

	for (const issue of issues) {
		if (issue.code !== 'content_cannibalization') continue;
		const urlA = issue.page;
		const urlB = issue.element ?? '';
		if (!urlA || !urlB) continue;
		const key = urlA < urlB ? `${urlA}\0${urlB}` : `${urlB}\0${urlA}`;
		if (seen.has(key)) continue;
		seen.add(key);

		let cosineSim = 0;
		let titleSim = 0;
		let sharedTerms: string[] = [];

		try {
			if (issue.current) {
				const parsed = JSON.parse(issue.current) as {
					cosineSim?: number;
					titleSim?: number;
					sharedTerms?: string[];
				};
				cosineSim = parsed.cosineSim ?? 0;
				titleSim = parsed.titleSim ?? 0;
				sharedTerms = Array.isArray(parsed.sharedTerms) ? parsed.sharedTerms : [];
			}
		} catch {
			// ignore parse errors
		}

		const fixAction = issue.fix?.action;
		const suggestion: CannibalizationPair['suggestion'] =
			fixAction === 'merge_into'
				? 'merge'
				: fixAction === 'redirect'
					? 'redirect'
					: fixAction === 'update_content'
						? 'differentiate'
						: 'review';

		// Reconstruct combined score from components
		const descSim = getDescSimFromIndex(ctx, urlA, urlB);
		const combined = Math.round((0.7 * cosineSim + 0.2 * titleSim + 0.1 * descSim) * 100) / 100;

		pairs.push({
			pageA: urlA,
			pageB: urlB,
			similarity: combined,
			cosineSim: Math.round(cosineSim * 100) / 100,
			titleSim: Math.round(titleSim * 100) / 100,
			descSim: Math.round(descSim * 100) / 100,
			sharedTerms,
			suggestion,
		});
	}

	// Sort by similarity descending
	pairs.sort((a, b) => b.similarity - a.similarity);
	return pairs;
}

function getDescSimFromIndex(ctx: SiteContext, urlA: string, urlB: string): number {
	const key = urlA < urlB ? `${urlA}\0${urlB}` : `${urlB}\0${urlA}`;
	return ctx.tfidf.descSimilarities.get(key) ?? 0;
}

// ---------------------------------------------------------------------------
// Union-Find helpers (local to runner, mirrors topical_clusters.ts)
// ---------------------------------------------------------------------------

function ufFind(parent: Map<string, string>, x: string): string {
	let root = parent.get(x) ?? x;
	if (root !== x) {
		root = ufFind(parent, root);
		parent.set(x, root);
	}
	return root;
}

function ufUnion(
	parent: Map<string, string>,
	rank: Map<string, number>,
	a: string,
	b: string,
): void {
	const ra = ufFind(parent, a);
	const rb = ufFind(parent, b);
	if (ra === rb) return;
	const rankA = rank.get(ra) ?? 0;
	const rankB = rank.get(rb) ?? 0;
	if (rankA < rankB) {
		parent.set(ra, rb);
	} else if (rankA > rankB) {
		parent.set(rb, ra);
	} else {
		parent.set(rb, ra);
		rank.set(ra, rankA + 1);
	}
}
