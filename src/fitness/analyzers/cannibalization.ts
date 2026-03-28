// ---------------------------------------------------------------------------
// Analyzer: cannibalization — Content overlap detection via TF-IDF + Levenshtein
//
// Combined similarity: 0.7 × cosineSim + 0.2 × titleSim + 0.1 × descSim
// Warning threshold: > 0.7
// Error threshold:   > 0.85
// ---------------------------------------------------------------------------

import type { CannibalizationPair } from '../../types.ts';
import {
	getCosineSimilarity,
	getDescSimilarity,
	getSharedTerms,
	getTitleSimilarity,
} from '../tfidf.ts';
import type { Analyzer, CheckResult, SiteContext } from '../types.ts';
import { fail, pass } from '../types.ts';

const DIMENSION = 'cannibalization';
const WARN_THRESHOLD = 0.7;
const ERROR_THRESHOLD = 0.85;

export const cannibalization: Analyzer = {
	id: 'cannibalization',
	dimension: DIMENSION,
	weight: 12,
	// Requires at least 2 pages to compare
	applies: (ctx) => ctx.pages.length >= 2,

	analyze(ctx: SiteContext): CheckResult[] {
		const results: CheckResult[] = [];
		const urls = ctx.pages.map((p) => p.url);
		let anyPairChecked = false;

		for (let i = 0; i < urls.length; i++) {
			for (let j = i + 1; j < urls.length; j++) {
				const urlA = urls[i] as string;
				const urlB = urls[j] as string;

				const cosineSim = getCosineSimilarity(ctx.tfidf, urlA, urlB);
				const titleSim = getTitleSimilarity(ctx.tfidf, urlA, urlB);
				const descSim = getDescSimilarity(ctx.tfidf, urlA, urlB);
				const combined = 0.7 * cosineSim + 0.2 * titleSim + 0.1 * descSim;

				anyPairChecked = true;

				if (combined <= WARN_THRESHOLD) {
					results.push(pass);
					continue;
				}

				const sharedTerms = getSharedTerms(ctx.tfidf, urlA, urlB, 5);
				const suggestion = pickSuggestion(combined, cosineSim, titleSim);

				const pair: CannibalizationPair = {
					pageA: urlA,
					pageB: urlB,
					similarity: Math.round(combined * 100) / 100,
					cosineSim: Math.round(cosineSim * 100) / 100,
					titleSim: Math.round(titleSim * 100) / 100,
					descSim: Math.round(descSim * 100) / 100,
					sharedTerms,
					suggestion,
				};

				const severity = combined > ERROR_THRESHOLD ? 'error' : 'warning';
				results.push(
					fail({
						severity,
						dimension: DIMENSION,
						code: 'content_cannibalization',
						message: `Pages "${urlA}" and "${urlB}" overlap at ${Math.round(combined * 100)}% similarity (${suggestion}).`,
						page: urlA,
						element: urlB,
						current: JSON.stringify({
							cosineSim: pair.cosineSim,
							titleSim: pair.titleSim,
							sharedTerms,
						}),
						fix: {
							file: urlA,
							action:
								suggestion === 'merge'
									? 'merge_into'
									: suggestion === 'redirect'
										? 'redirect'
										: 'update_content',
							target: urlB,
						},
					}),
				);
			}
		}

		if (!anyPairChecked) results.push(pass);

		return results;
	},
};

function pickSuggestion(
	combined: number,
	cosineSim: number,
	titleSim: number,
): CannibalizationPair['suggestion'] {
	if (combined > ERROR_THRESHOLD && titleSim > 0.8) return 'merge';
	if (cosineSim > 0.8) return 'differentiate';
	if (combined > ERROR_THRESHOLD) return 'redirect';
	return 'review';
}
