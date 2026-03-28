// ---------------------------------------------------------------------------
// Analyzer: eeat — E-E-A-T signals (Experience, Expertise, Authority, Trust)
//
// Checks signals that indicate author expertise and content trustworthiness.
// Applies only to content-oriented pages (articles, blog posts, guides).
// ---------------------------------------------------------------------------

import { getMetaName, getMetaProperty, getTitle } from '../html_parser.ts';
import type { Analyzer, CheckResult, SiteContext } from '../types.ts';
import { fail, pass } from '../types.ts';

const DIMENSION = 'eeat';

/** Layout types that are content pages warranting E-E-A-T signals. */
const CONTENT_LAYOUTS = new Set(['post', 'blog', 'article', 'guide']);

/** Minimum word count to care about E-E-A-T (short pages are fine without). */
const MIN_WORDS_FOR_EEAT = 300;

export const eeat: Analyzer = {
	id: 'eeat',
	dimension: DIMENSION,
	weight: 6,
	// Only applies if at least one content page exists
	applies: (ctx) =>
		ctx.pages.some((p) => {
			const layout = p.frontmatter.layout
				? String(p.frontmatter.layout).replace('.html', '')
				: 'page';
			return CONTENT_LAYOUTS.has(layout) && p.wordCount >= MIN_WORDS_FOR_EEAT;
		}),

	analyze(ctx: SiteContext): CheckResult[] {
		const results: CheckResult[] = [];

		for (const page of ctx.pages) {
			const { url, frontmatter, wordCount, html } = page;
			const layout = frontmatter.layout ? String(frontmatter.layout).replace('.html', '') : 'page';

			// Only check content-heavy pages
			if (!CONTENT_LAYOUTS.has(layout) || wordCount < MIN_WORDS_FOR_EEAT) continue;

			// --- Author presence ---
			// Check frontmatter.author, og:article:author, or meta author
			const fmAuthor = frontmatter.author ? String(frontmatter.author).trim() : '';
			const metaAuthor = getMetaName(html, 'author').trim();
			const ogAuthor = getMetaProperty(html, 'article:author').trim();
			const hasAuthor = fmAuthor.length > 0 || metaAuthor.length > 0 || ogAuthor.length > 0;

			if (!hasAuthor) {
				results.push(
					fail({
						severity: 'warning',
						dimension: DIMENSION,
						code: 'missing_author',
						message: `Content page "${url}" has no author attribution — important for E-E-A-T signals.`,
						page: url,
						fix: { file: page.file, action: 'set_frontmatter', field: 'author' },
					}),
				);
			} else {
				results.push(pass);
			}

			// --- Publication date ---
			const hasDate = Boolean(frontmatter.date);
			if (!hasDate) {
				results.push(
					fail({
						severity: 'warning',
						dimension: DIMENSION,
						code: 'missing_date',
						message: `Content page "${url}" has no publication date — date signals freshness and trustworthiness.`,
						page: url,
						fix: { file: page.file, action: 'set_frontmatter', field: 'date' },
					}),
				);
			} else {
				results.push(pass);
			}

			// --- Schema.org author/datePublished presence (reinforces E-E-A-T) ---
			// This is a soft signal: if the page has Article/BlogPosting schema,
			// the schema_validation analyzer handles required props.
			// Here we just check that the title and description are substantive.
			const titleText = (getTitle(html) || String(frontmatter.title ?? '')).trim();
			const descText = (
				getMetaName(html, 'description') || String(frontmatter.description ?? '')
			).trim();

			// Title should not be generic / very short
			if (titleText.length > 0 && titleText.split(/\s+/).length < 3) {
				results.push(
					fail({
						severity: 'info',
						dimension: DIMENSION,
						code: 'title_too_short_for_eeat',
						message: `Page title "${titleText}" on "${url}" is very short — descriptive titles improve perceived expertise.`,
						page: url,
						current: titleText,
						expected: 'A descriptive title of ≥ 3 words',
						fix: { file: page.file, action: 'set_frontmatter', field: 'title' },
					}),
				);
			} else if (titleText.length > 0) {
				results.push(pass);
			}

			// Description should be present and substantive for content pages
			if (descText.length === 0) {
				results.push(
					fail({
						severity: 'info',
						dimension: DIMENSION,
						code: 'missing_description_eeat',
						message: `Content page "${url}" has no meta description — descriptions help establish topical authority.`,
						page: url,
						fix: { file: page.file, action: 'set_frontmatter', field: 'description' },
					}),
				);
			} else {
				results.push(pass);
			}
		}

		return results;
	},
};
