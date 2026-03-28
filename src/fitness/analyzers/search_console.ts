// ---------------------------------------------------------------------------
// Analyzer: search_console — GSC performance data integration
//
// Uses Google Search Console data to identify underperforming pages, keyword
// opportunities, content gaps, and URL flickering (keyword cannibalization).
// Applies only when GSC data is available.
// ---------------------------------------------------------------------------

import type { GscRow } from '../../types.ts';
import type { Analyzer, CheckResult, SiteContext } from '../types.ts';
import { fail, pass } from '../types.ts';

const DIMENSION = 'search_console';

/** Expected CTR by average position. */
function expectedCtr(position: number): number {
	if (position <= 1) return 0.3;
	if (position <= 2) return 0.15;
	if (position <= 3) return 0.1;
	if (position <= 4) return 0.07;
	if (position <= 10) return 0.04;
	return 0.02;
}

function findPageFile(ctx: SiteContext, pageUrl: string): string {
	return ctx.pages.find((p) => p.url === pageUrl || p.url === `${pageUrl}/`)?.file ?? pageUrl;
}

export const searchConsole: Analyzer = {
	id: 'search_console',
	dimension: DIMENSION,
	weight: 15,
	applies: (ctx) => ctx.searchConsole !== undefined && (ctx.searchConsole?.rows.length ?? 0) > 0,

	analyze(ctx: SiteContext): CheckResult[] {
		const results: CheckResult[] = [];
		// searchConsole is guaranteed defined by applies() gate
		const rows = ctx.searchConsole?.rows ?? [];

		// Group rows by page
		const byPage = new Map<string, GscRow[]>();
		for (const row of rows) {
			let pageRows = byPage.get(row.page);
			if (!pageRows) {
				pageRows = [];
				byPage.set(row.page, pageRows);
			}
			pageRows.push(row);
		}

		// 1. underperforming_ctr — pages with impressions >= 100 and CTR < 50% of expected
		for (const [page, pageRows] of byPage) {
			const pageFile = findPageFile(ctx, page);
			for (const row of pageRows) {
				if (row.impressions < 100) continue;
				const expected = expectedCtr(row.position);
				if (row.ctr < expected * 0.5) {
					results.push(
						fail({
							severity: 'warning',
							dimension: DIMENSION,
							code: 'low_ctr',
							message: `Page "${page}" query "${row.query}" has ${row.impressions} impressions at position ${row.position.toFixed(1)} but CTR ${(row.ctr * 100).toFixed(1)}% (expected ~${(expected * 100).toFixed(0)}%) — title or description may not be compelling.`,
							page,
							fix: { file: pageFile, action: 'set_frontmatter', field: 'title' },
						}),
					);
				} else {
					results.push(pass);
				}
			}
		}

		// 2. keyword_opportunity — position 4–10 with >= 200 impressions
		for (const [page, pageRows] of byPage) {
			const pageFile = findPageFile(ctx, page);
			for (const row of pageRows) {
				if (row.impressions < 200) continue;
				if (row.position >= 4 && row.position <= 10) {
					results.push(
						fail({
							severity: 'info',
							dimension: DIMENSION,
							code: 'keyword_opportunity',
							message: `Page "${page}" ranks position ${row.position.toFixed(1)} for "${row.query}" with ${row.impressions} impressions — optimize title/meta for this term to reach top 3.`,
							page,
							fix: { file: pageFile, action: 'set_frontmatter', field: 'keyword' },
						}),
					);
				} else {
					results.push(pass);
				}
			}
		}

		// 3. content_gap — queries with >= 50 total impressions and no dedicated page
		const queryImpressions = new Map<string, number>();
		for (const row of rows) {
			queryImpressions.set(row.query, (queryImpressions.get(row.query) ?? 0) + row.impressions);
		}

		let gapCount = 0;
		for (const [query, impressions] of queryImpressions) {
			if (impressions < 50) continue;
			if (gapCount >= 10) break;

			// Check if any page URL contains a significant word from the query
			const queryWords = query
				.toLowerCase()
				.split(/\s+/)
				.filter((w) => w.length >= 4);
			const hasDedicatedPage = queryWords.some((word) => {
				for (const pageUrl of ctx.pageSet) {
					const path = pageUrl.replace(/^\//, '');
					if (path.includes(word)) return true;
				}
				return false;
			});

			if (!hasDedicatedPage) {
				results.push(
					fail({
						severity: 'info',
						dimension: DIMENSION,
						code: 'content_gap',
						message: `Query "${query}" has ${impressions} impressions but no dedicated page — consider creating content targeting this topic.`,
						page: '/',
						fix: { file: 'content/', action: 'create_file' },
					}),
				);
				gapCount++;
			} else {
				results.push(pass);
			}
		}

		// 4. url_flickering — same query served by 2+ pages each with >= 20 impressions
		const queryPages = new Map<string, Map<string, number>>();
		for (const row of rows) {
			let pageMap = queryPages.get(row.query);
			if (!pageMap) {
				pageMap = new Map();
				queryPages.set(row.query, pageMap);
			}
			pageMap.set(row.page, (pageMap.get(row.page) ?? 0) + row.impressions);
		}

		for (const [query, pageMap] of queryPages) {
			const qualifyingPages = [...pageMap.entries()].filter(([, imp]) => imp >= 20);
			if (qualifyingPages.length >= 2) {
				const pageList = qualifyingPages.map(([p]) => `"${p}"`).join(', ');
				results.push(
					fail({
						severity: 'warning',
						dimension: DIMENSION,
						code: 'url_flickering',
						message: `Query "${query}" is served by ${qualifyingPages.length} different pages (${pageList}) each with significant impressions — consolidate or differentiate content to prevent cannibalization.`,
						page: qualifyingPages[0]?.[0] ?? '/',
					}),
				);
			} else if (qualifyingPages.length === 1) {
				results.push(pass);
			}
		}

		return results;
	},
};
