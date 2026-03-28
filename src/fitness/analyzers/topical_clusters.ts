// ---------------------------------------------------------------------------
// Analyzer: topical_clusters — Content topology using TF-IDF cosine clusters
//
// Groups pages into clusters where any two pages share cosine similarity ≥ 0.25.
// Uses union-find for O(N·α(N)) ≈ O(N) clustering.
// Detects: orphan topics, missing pillar pages, over-saturated clusters.
// ---------------------------------------------------------------------------

import { getCosineSimilarity } from '../tfidf.ts';
import type { Analyzer, CheckResult, SiteContext } from '../types.ts';
import { fail, pass } from '../types.ts';

const DIMENSION = 'topical_clusters';
const CLUSTER_THRESHOLD = 0.25; // min cosine to be "in same cluster"
const PILLAR_MIN_INCOMING = 2; // pillar pages should have ≥ this many internal links
const MAX_CLUSTER_SIZE = 15;
const MIN_CLUSTER_SUPPORT = 1; // singleton clusters are "orphan topics"

export const topicalClusters: Analyzer = {
	id: 'topical_clusters',
	dimension: DIMENSION,
	weight: 8,
	applies: (ctx) => ctx.pages.length >= 3,

	analyze(ctx: SiteContext): CheckResult[] {
		const results: CheckResult[] = [];
		const urls = ctx.pages.map((p) => p.url);

		// Build union-find clusters
		const parent = new Map<string, string>();
		const rank = new Map<string, number>();
		for (const u of urls) {
			parent.set(u, u);
			rank.set(u, 0);
		}

		for (let i = 0; i < urls.length; i++) {
			for (let j = i + 1; j < urls.length; j++) {
				const ua = urls[i] as string;
				const ub = urls[j] as string;
				const sim = getCosineSimilarity(ctx.tfidf, ua, ub);
				if (sim >= CLUSTER_THRESHOLD) {
					union(parent, rank, ua, ub);
				}
			}
		}

		// Group pages by cluster root
		const clusters = new Map<string, string[]>();
		for (const u of urls) {
			const root = find(parent, u);
			const group = clusters.get(root) ?? [];
			group.push(u);
			clusters.set(root, group);
		}

		// Detect issues per cluster
		for (const [, clusterPages] of clusters) {
			// Singleton = orphan topic (no topical neighbours)
			if (clusterPages.length === MIN_CLUSTER_SUPPORT) {
				const url = clusterPages[0] as string;
				if (url !== '/') {
					results.push(
						fail({
							severity: 'info',
							dimension: DIMENSION,
							code: 'orphan_topic',
							message: `Page "${url}" does not share topical similarity with any other page.`,
							page: url,
						}),
					);
				} else {
					results.push(pass);
				}
				continue;
			}

			// Over-saturated cluster
			if (clusterPages.length > MAX_CLUSTER_SIZE) {
				results.push(
					fail({
						severity: 'info',
						dimension: DIMENSION,
						code: 'cluster_oversaturated',
						message: `Cluster of ${clusterPages.length} topically similar pages may benefit from splitting into sub-topics.`,
						page: clusterPages[0] ?? '',
						current: String(clusterPages.length),
						expected: `≤ ${MAX_CLUSTER_SIZE}`,
					}),
				);
			} else {
				results.push(pass);
			}

			// Missing pillar: no page in cluster has ≥ PILLAR_MIN_INCOMING incoming links
			const pillarCandidates = clusterPages.filter(
				(u) => (ctx.linkGraph.incoming.get(u)?.length ?? 0) >= PILLAR_MIN_INCOMING,
			);
			if (pillarCandidates.length === 0 && clusterPages.length >= 3) {
				results.push(
					fail({
						severity: 'warning',
						dimension: DIMENSION,
						code: 'missing_pillar_page',
						message: `Cluster of ${clusterPages.length} pages has no pillar page (a hub with ≥ ${PILLAR_MIN_INCOMING} incoming internal links).`,
						page: clusterPages[0] ?? '',
						fix: { file: clusterPages[0] ?? '', action: 'add_content' },
					}),
				);
			} else if (clusterPages.length >= 3) {
				results.push(pass);
			}
		}

		return results;
	},
};

// ---------------------------------------------------------------------------
// Union-Find
// ---------------------------------------------------------------------------

function find(parent: Map<string, string>, x: string): string {
	let root = parent.get(x) ?? x;
	if (root !== x) {
		root = find(parent, root);
		parent.set(x, root); // path compression
	}
	return root;
}

function union(parent: Map<string, string>, rank: Map<string, number>, a: string, b: string): void {
	const ra = find(parent, a);
	const rb = find(parent, b);
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
