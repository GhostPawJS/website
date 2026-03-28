// ---------------------------------------------------------------------------
// Analyzer: seo_meta — Page-level meta tag signals
// Checks: title, description, canonical, viewport, charset, lang, robots
// ---------------------------------------------------------------------------

import { getCanonical, getHtmlLang, getMetaName, getTitle } from '../html_parser.ts';
import type { Analyzer, CheckResult, SiteContext } from '../types.ts';
import { fail, pass } from '../types.ts';

const DIMENSION = 'seo_meta';
const TITLE_MIN = 10;
const TITLE_MAX = 60;
const DESC_MIN = 70;
const DESC_MAX = 165;

export const seoMeta: Analyzer = {
	id: 'seo_meta',
	dimension: DIMENSION,
	weight: 15,
	applies: () => true,

	analyze(ctx: SiteContext): CheckResult[] {
		const results: CheckResult[] = [];

		// Track titles/descriptions for uniqueness across site
		const titleCount = new Map<string, number>();
		const descCount = new Map<string, number>();
		for (const page of ctx.pages) {
			const t = getTitle(page.html).trim();
			const d = getMetaName(page.html, 'description').trim();
			if (t) titleCount.set(t, (titleCount.get(t) ?? 0) + 1);
			if (d) descCount.set(d, (descCount.get(d) ?? 0) + 1);
		}

		for (const page of ctx.pages) {
			const { url, html, frontmatter } = page;

			// --- Title ---
			const title = getTitle(html).trim();
			if (!title) {
				results.push(
					fail({
						severity: 'error',
						dimension: DIMENSION,
						code: 'title_missing',
						message: 'Page has no <title> tag.',
						page: url,
						fix: {
							file: page.file,
							action: 'set_frontmatter',
							field: 'title',
							value: 'Add a descriptive title',
						},
					}),
				);
			} else {
				results.push(pass);
				if (title.length < TITLE_MIN) {
					results.push(
						fail({
							severity: 'warning',
							dimension: DIMENSION,
							code: 'title_too_short',
							message: `Title is ${title.length} chars (min ${TITLE_MIN}).`,
							page: url,
							current: title,
							expected: `${TITLE_MIN}–${TITLE_MAX} characters`,
						}),
					);
				} else if (title.length > TITLE_MAX) {
					results.push(
						fail({
							severity: 'warning',
							dimension: DIMENSION,
							code: 'title_too_long',
							message: `Title is ${title.length} chars (max ${TITLE_MAX}).`,
							page: url,
							current: title,
							expected: `${TITLE_MIN}–${TITLE_MAX} characters`,
						}),
					);
				} else {
					results.push(pass);
				}

				// Uniqueness
				if ((titleCount.get(title) ?? 0) > 1) {
					results.push(
						fail({
							severity: 'error',
							dimension: DIMENSION,
							code: 'title_duplicate',
							message: `Title "${title}" appears on multiple pages.`,
							page: url,
						}),
					);
				} else {
					results.push(pass);
				}

				// Keyword front-loading
				const keyword = frontmatter.keyword ? String(frontmatter.keyword).toLowerCase() : null;
				if (keyword) {
					const keywordInFirst = title
						.toLowerCase()
						.slice(0, Math.floor(title.length / 2))
						.includes(keyword);
					if (!keywordInFirst) {
						results.push(
							fail({
								severity: 'info',
								dimension: DIMENSION,
								code: 'title_keyword_not_front_loaded',
								message: `Keyword "${keyword}" not found in the first half of the title.`,
								page: url,
							}),
						);
					} else {
						results.push(pass);
					}
				}
			}

			// --- Meta description ---
			const desc = getMetaName(html, 'description').trim();
			if (!desc) {
				results.push(
					fail({
						severity: 'error',
						dimension: DIMENSION,
						code: 'description_missing',
						message: 'Page has no meta description.',
						page: url,
						fix: {
							file: page.file,
							action: 'set_frontmatter',
							field: 'description',
							value: 'Add a compelling description',
						},
					}),
				);
			} else {
				results.push(pass);
				if (desc.length < DESC_MIN) {
					results.push(
						fail({
							severity: 'warning',
							dimension: DIMENSION,
							code: 'description_too_short',
							message: `Description is ${desc.length} chars (min ${DESC_MIN}).`,
							page: url,
							current: String(desc.length),
							expected: `${DESC_MIN}–${DESC_MAX} characters`,
						}),
					);
				} else if (desc.length > DESC_MAX) {
					results.push(
						fail({
							severity: 'warning',
							dimension: DIMENSION,
							code: 'description_too_long',
							message: `Description is ${desc.length} chars (max ${DESC_MAX}).`,
							page: url,
							current: String(desc.length),
							expected: `${DESC_MIN}–${DESC_MAX} characters`,
						}),
					);
				} else {
					results.push(pass);
				}

				if ((descCount.get(desc) ?? 0) > 1) {
					results.push(
						fail({
							severity: 'warning',
							dimension: DIMENSION,
							code: 'description_duplicate',
							message: 'Meta description appears on multiple pages.',
							page: url,
						}),
					);
				} else {
					results.push(pass);
				}
			}

			// --- Canonical ---
			const canonical = getCanonical(html);
			if (!canonical) {
				results.push(
					fail({
						severity: 'error',
						dimension: DIMENSION,
						code: 'canonical_missing',
						message: 'Page has no <link rel="canonical"> tag.',
						page: url,
					}),
				);
			} else {
				results.push(pass);
				// Should be absolute
				if (!canonical.startsWith('http')) {
					results.push(
						fail({
							severity: 'warning',
							dimension: DIMENSION,
							code: 'canonical_not_absolute',
							message: 'Canonical URL should be absolute.',
							page: url,
							current: canonical,
						}),
					);
				} else {
					results.push(pass);
				}
			}

			// --- Viewport ---
			const viewport = getMetaName(html, 'viewport');
			if (!viewport) {
				results.push(
					fail({
						severity: 'error',
						dimension: DIMENSION,
						code: 'viewport_missing',
						message: 'Missing <meta name="viewport"> tag.',
						page: url,
					}),
				);
			} else {
				results.push(pass);
			}

			// --- Charset ---
			const hasCharset = /<meta[^>]+charset/i.test(html);
			if (!hasCharset) {
				results.push(
					fail({
						severity: 'warning',
						dimension: DIMENSION,
						code: 'charset_missing',
						message: 'Missing charset declaration.',
						page: url,
					}),
				);
			} else {
				results.push(pass);
			}

			// --- html lang attribute ---
			const lang = getHtmlLang(html);
			if (!lang) {
				results.push(
					fail({
						severity: 'warning',
						dimension: DIMENSION,
						code: 'html_lang_missing',
						message: 'Missing lang attribute on <html> element.',
						page: url,
						fix: { file: 'templates/base.html', action: 'update_template' },
					}),
				);
			} else if (lang.slice(0, 2) !== ctx.config.language.slice(0, 2)) {
				results.push(
					fail({
						severity: 'warning',
						dimension: DIMENSION,
						code: 'html_lang_mismatch',
						message: `html lang="${lang}" does not match site language "${ctx.config.language}".`,
						page: url,
					}),
				);
			} else {
				results.push(pass);
			}

			// --- noindex frontmatter consistency ---
			const robotsMeta = getMetaName(html, 'robots');
			const hasNoindex = robotsMeta.includes('noindex');
			if (frontmatter.noindex && !hasNoindex) {
				results.push(
					fail({
						severity: 'warning',
						dimension: DIMENSION,
						code: 'noindex_not_in_html',
						message: 'Frontmatter noindex:true but robots meta tag not present in HTML.',
						page: url,
					}),
				);
			} else {
				results.push(pass);
			}
		}

		return results;
	},
};
