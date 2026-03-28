// ---------------------------------------------------------------------------
// Analyzer: seo_structure — Content structure signals for crawlers
// Checks: single H1, heading hierarchy, descriptive headings, URL slugs
// ---------------------------------------------------------------------------

import { getHeadings } from '../html_parser.ts';
import type { Analyzer, CheckResult, SiteContext } from '../types.ts';
import { fail, pass } from '../types.ts';

const DIMENSION = 'seo_structure';
const GENERIC_HEADINGS = new Set([
	'introduction',
	'conclusion',
	'overview',
	'summary',
	'background',
	'details',
	'content',
	'section',
	'body',
	'main',
	'text',
	'information',
]);

export const seoStructure: Analyzer = {
	id: 'seo_structure',
	dimension: DIMENSION,
	weight: 10,
	applies: () => true,

	analyze(ctx: SiteContext): CheckResult[] {
		const results: CheckResult[] = [];

		for (const page of ctx.pages) {
			const { url, html, frontmatter } = page;
			const headings = getHeadings(html);

			// --- Exactly one H1 ---
			const h1s = headings.filter((h) => h.level === 1);
			if (h1s.length === 0) {
				results.push(
					fail({
						severity: 'error',
						dimension: DIMENSION,
						code: 'h1_missing',
						message: 'Page has no <h1> element.',
						page: url,
						fix: { file: page.file, action: 'add_content' },
					}),
				);
			} else {
				results.push(pass);
				if (h1s.length > 1) {
					results.push(
						fail({
							severity: 'warning',
							dimension: DIMENSION,
							code: 'h1_multiple',
							message: `Page has ${h1s.length} <h1> elements (expected exactly 1).`,
							page: url,
							current: String(h1s.length),
							expected: '1',
						}),
					);
				} else {
					results.push(pass);
				}

				// Keyword in H1
				const keyword = frontmatter.keyword ? String(frontmatter.keyword).toLowerCase() : null;
				if (keyword && h1s[0]) {
					if (!h1s[0].text.toLowerCase().includes(keyword)) {
						results.push(
							fail({
								severity: 'info',
								dimension: DIMENSION,
								code: 'h1_keyword_missing',
								message: `H1 does not contain the target keyword "${keyword}".`,
								page: url,
								current: h1s[0].text,
							}),
						);
					} else {
						results.push(pass);
					}
				}
			}

			// --- Heading hierarchy (no skipped levels) ---
			let prevLevel = 0;
			let hierarchyOk = true;
			for (const h of headings) {
				if (prevLevel > 0 && h.level > prevLevel + 1) {
					results.push(
						fail({
							severity: 'warning',
							dimension: DIMENSION,
							code: 'heading_hierarchy_skipped',
							message: `Heading level skipped: h${prevLevel} → h${h.level} ("${h.text}").`,
							page: url,
							element: `h${h.level}`,
							current: `h${prevLevel} → h${h.level}`,
							expected: `h${prevLevel} → h${prevLevel + 1}`,
						}),
					);
					hierarchyOk = false;
					break;
				}
				prevLevel = h.level;
			}
			if (hierarchyOk && headings.length > 0) results.push(pass);

			// --- Generic heading detection ---
			const genericFound = headings.some((h) => GENERIC_HEADINGS.has(h.text.toLowerCase()));
			if (genericFound) {
				const generic = headings.find((h) => GENERIC_HEADINGS.has(h.text.toLowerCase()));
				results.push(
					fail({
						severity: 'info',
						dimension: DIMENSION,
						code: 'heading_generic',
						message: `Generic heading detected: "${generic?.text}". Use descriptive headings.`,
						page: url,
						...(generic?.text ? { element: generic.text } : {}),
					}),
				);
			} else if (headings.length > 0) {
				results.push(pass);
			}

			// --- URL slug quality ---
			const slug = url.replace(/^\/|\/$/g, '');
			if (slug) {
				// Must be lowercase, hyphenated, no special chars
				if (!/^[a-z0-9][a-z0-9\-/]*$/.test(slug)) {
					results.push(
						fail({
							severity: 'warning',
							dimension: DIMENSION,
							code: 'url_slug_invalid',
							message: `URL slug "${slug}" contains uppercase letters, spaces, or special characters.`,
							page: url,
							current: slug,
							expected: 'lowercase, hyphens, and slashes only',
						}),
					);
				} else if (/--/.test(slug)) {
					results.push(
						fail({
							severity: 'warning',
							dimension: DIMENSION,
							code: 'url_slug_double_hyphen',
							message: `URL slug "${slug}" contains double hyphens.`,
							page: url,
							current: slug,
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
