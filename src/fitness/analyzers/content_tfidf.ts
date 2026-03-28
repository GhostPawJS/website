// ---------------------------------------------------------------------------
// Analyzer: content_tfidf — Per-page term distinctiveness
// Checks: pages with no distinctive terms, keyword alignment, over-optimization
// ---------------------------------------------------------------------------

import type { Analyzer, CheckResult, SiteContext } from '../types.ts';
import { fail, pass } from '../types.ts';

const DIMENSION = 'content_tfidf';
/** Pages with fewer than this many top terms are "thin content". */
const MIN_DISTINCTIVE_TERMS = 3;
/** If any single term has a TF-IDF score above this fraction of total, flag it. */
const OVER_OPTIMIZATION_RATIO = 0.4;

export const contentTfidf: Analyzer = {
	id: 'content_tfidf',
	dimension: DIMENSION,
	weight: 10,
	applies: (ctx) => ctx.pages.length >= 2, // TF-IDF needs multiple docs

	analyze(ctx: SiteContext): CheckResult[] {
		const results: CheckResult[] = [];

		for (const page of ctx.pages) {
			const { url, frontmatter } = page;
			const vector = ctx.tfidf.vectors.get(url);

			if (!vector || vector.raw.size === 0) {
				if (page.wordCount > 50) {
					// Has content but no distinctive terms → truly thin/generic
					results.push(
						fail({
							severity: 'warning',
							dimension: DIMENSION,
							code: 'no_distinctive_terms',
							message: `Page "${url}" has no topically distinctive terms — content may be too generic.`,
							page: url,
							fix: { file: page.file, action: 'update_content' },
						}),
					);
				}
				continue;
			}

			// --- Thin content check ---
			if (vector.topTerms.length < MIN_DISTINCTIVE_TERMS) {
				results.push(
					fail({
						severity: 'warning',
						dimension: DIMENSION,
						code: 'too_few_distinctive_terms',
						message: `Page "${url}" has only ${vector.topTerms.length} distinctive term(s) — content may be thin.`,
						page: url,
						current: String(vector.topTerms.length),
						expected: `≥ ${MIN_DISTINCTIVE_TERMS}`,
						fix: { file: page.file, action: 'add_content' },
					}),
				);
			} else {
				results.push(pass);
			}

			// --- Keyword alignment ---
			const keyword = frontmatter.keyword ? String(frontmatter.keyword).toLowerCase() : null;
			if (keyword) {
				// Check if keyword (or any of its component words) appears in top terms
				const keyTerms = keyword.split(/\s+/).filter((w) => w.length >= 3);
				const topTermsSet = new Set(vector.topTerms);
				const aligned = keyTerms.some((kt) => topTermsSet.has(kt));

				if (!aligned && vector.topTerms.length >= MIN_DISTINCTIVE_TERMS) {
					results.push(
						fail({
							severity: 'warning',
							dimension: DIMENSION,
							code: 'keyword_tfidf_misalignment',
							message: `Target keyword "${keyword}" not among top TF-IDF terms for "${url}". Top terms: ${vector.topTerms.slice(0, 5).join(', ')}.`,
							page: url,
							current: vector.topTerms.slice(0, 5).join(', '),
							expected: `"${keyword}" among top terms`,
							fix: { file: page.file, action: 'update_content' },
						}),
					);
				} else {
					results.push(pass);
				}
			}

			// --- Over-optimization check ---
			const totalScore = [...vector.raw.values()].reduce((s, v) => s + v, 0);
			if (totalScore > 0) {
				const maxScore = Math.max(...vector.raw.values());
				const maxTerm = [...vector.raw.entries()].find(([, v]) => v === maxScore)?.[0] ?? '';
				const ratio = maxScore / totalScore;
				if (ratio > OVER_OPTIMIZATION_RATIO) {
					results.push(
						fail({
							severity: 'info',
							dimension: DIMENSION,
							code: 'over_optimization',
							message: `Term "${maxTerm}" dominates ${Math.round(ratio * 100)}% of TF-IDF mass on "${url}" — possible over-optimization.`,
							page: url,
							element: maxTerm,
							current: `${Math.round(ratio * 100)}%`,
							expected: `< ${Math.round(OVER_OPTIMIZATION_RATIO * 100)}%`,
						}),
					);
				} else {
					results.push(pass);
				}
			}
		}

		return results;
	},
};
