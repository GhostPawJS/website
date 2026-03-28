// ---------------------------------------------------------------------------
// Analyzer: sitemap_robots — Crawl infrastructure
// Checks: sitemap.xml exists, robots.txt exists, noindex pages not in sitemap
// (Content is pre-loaded into SiteContext by context.ts)
// ---------------------------------------------------------------------------

import type { Analyzer, CheckResult, SiteContext } from '../types.ts';
import { fail, pass } from '../types.ts';

const DIMENSION = 'sitemap_robots';

export const sitemapRobots: Analyzer = {
	id: 'sitemap_robots',
	dimension: DIMENSION,
	weight: 8,
	applies: () => true,

	analyze(ctx: SiteContext): CheckResult[] {
		const results: CheckResult[] = [];
		const { sitemapXml, robotsTxt, pages } = ctx;

		// --- sitemap.xml exists ---
		if (!sitemapXml) {
			results.push(
				fail({
					severity: 'error',
					dimension: DIMENSION,
					code: 'sitemap_missing',
					message: 'sitemap.xml not found in dist/. Run build() to generate it.',
					page: '',
					fix: { file: 'dist/sitemap.xml', action: 'create_file' },
				}),
			);
		} else {
			results.push(pass);

			// Valid XML: must contain <urlset
			if (!sitemapXml.includes('<urlset')) {
				results.push(
					fail({
						severity: 'error',
						dimension: DIMENSION,
						code: 'sitemap_invalid_xml',
						message: 'sitemap.xml does not contain a valid <urlset> element.',
						page: '',
					}),
				);
			} else {
				results.push(pass);
			}

			// noindex pages must not appear in sitemap
			const noindexPages = pages.filter((p) => p.frontmatter.noindex);
			for (const noindexPage of noindexPages) {
				if (sitemapXml.includes(noindexPage.url)) {
					results.push(
						fail({
							severity: 'error',
							dimension: DIMENSION,
							code: 'noindex_in_sitemap',
							message: `Page "${noindexPage.url}" is noindex but appears in sitemap.xml.`,
							page: noindexPage.url,
						}),
					);
				} else {
					results.push(pass);
				}
			}
		}

		// --- robots.txt exists ---
		if (!robotsTxt) {
			results.push(
				fail({
					severity: 'error',
					dimension: DIMENSION,
					code: 'robots_missing',
					message: 'robots.txt not found in dist/.',
					page: '',
					fix: { file: 'assets/robots.txt', action: 'create_file' },
				}),
			);
		} else {
			results.push(pass);

			// Must reference sitemap
			if (!robotsTxt.toLowerCase().includes('sitemap:')) {
				results.push(
					fail({
						severity: 'warning',
						dimension: DIMENSION,
						code: 'robots_no_sitemap_ref',
						message: 'robots.txt does not reference the sitemap URL.',
						page: '',
						fix: { file: 'assets/robots.txt', action: 'update_content' },
					}),
				);
			} else {
				results.push(pass);
			}
		}

		return results;
	},
};
