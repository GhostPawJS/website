// ---------------------------------------------------------------------------
// Scoring: convert CheckResult[] arrays into DimensionScore / PageScore /
// overall FitnessReport scores.
// ---------------------------------------------------------------------------

import type { DimensionScore, Issue, PageScore, ReadabilityScores } from '../types.ts';
import type { CheckResult, SiteContext } from './types.ts';

// ---------------------------------------------------------------------------
// Dimension score
// ---------------------------------------------------------------------------

const ERROR_PENALTY = 12;
const WARN_PENALTY = 5;

/**
 * Compute a DimensionScore from a flat list of CheckResults.
 *
 * Score formula (clamped 0–100):
 *   base = 100
 *   deductions = errors × ERROR_PENALTY + warnings × WARN_PENALTY
 *   score = max(0, base - deductions)
 */
export function computeDimensionScore(results: CheckResult[]): DimensionScore {
	let passed = 0;
	let failed = 0;
	const issues: Issue[] = [];

	for (const r of results) {
		if (r.pass) {
			passed++;
		} else {
			failed++;
			issues.push(r.issue);
		}
	}

	const errors = issues.filter((i) => i.severity === 'error').length;
	const warnings = issues.filter((i) => i.severity === 'warning').length;
	const score = Math.max(0, Math.min(100, 100 - errors * ERROR_PENALTY - warnings * WARN_PENALTY));

	return { score, passed, failed, issues };
}

// ---------------------------------------------------------------------------
// Per-page score aggregation
// ---------------------------------------------------------------------------

/**
 * Build the `pages` map of a FitnessReport.
 *
 * For each page, collects all issues targeting that URL from every dimension,
 * computes a page-level score (penalty-based), and attaches readability + word-count
 * from the SiteContext.
 */
export function computePageScores(ctx: SiteContext, allIssues: Issue[]): Record<string, PageScore> {
	const result: Record<string, PageScore> = {};

	for (const page of ctx.pages) {
		const pageIssues = allIssues.filter((i) => i.page === page.url || i.page === '');
		const errors = pageIssues.filter((i) => i.severity === 'error').length;
		const warnings = pageIssues.filter((i) => i.severity === 'warning').length;
		const score = Math.max(
			0,
			Math.min(100, 100 - errors * ERROR_PENALTY - warnings * WARN_PENALTY),
		);

		const stats = ctx.language.textStats(page.textContent);
		const readability = ctx.language.readability(stats);
		const topTerms = ctx.tfidf.vectors.get(page.url)?.topTerms ?? [];

		result[page.url] = {
			url: page.url,
			score,
			issues: pageIssues,
			readability: normalizeReadability(readability),
			wordCount: page.wordCount,
			tfidfTopTerms: topTerms,
		};
	}

	return result;
}

// ---------------------------------------------------------------------------
// Overall score
// ---------------------------------------------------------------------------

/**
 * Compute the weighted overall score from all dimension scores.
 *
 * overall = Σ(dimension.score × weight) / Σ(weight)
 */
export function computeOverallScore(
	dimensionScores: Array<{ score: number; weight: number }>,
): number {
	if (dimensionScores.length === 0) return 100;
	let weightedSum = 0;
	let totalWeight = 0;
	for (const { score, weight } of dimensionScores) {
		weightedSum += score * weight;
		totalWeight += weight;
	}
	if (totalWeight === 0) return 100;
	return Math.round(weightedSum / totalWeight);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeReadability(r: ReadabilityScores): ReadabilityScores {
	return {
		fleschReadingEase: clamp1(r.fleschReadingEase),
		fleschKincaidGrade: Math.max(0, r.fleschKincaidGrade),
		gunningFog: Math.max(0, r.gunningFog),
		avgSentenceLength: Math.max(0, r.avgSentenceLength),
		avgSyllablesPerWord: Math.max(0, r.avgSyllablesPerWord),
	};
}

/** Clamp a Flesch RE score to [0, 100] range (it can theoretically exceed). */
function clamp1(v: number): number {
	return Math.max(0, Math.min(100, v));
}
