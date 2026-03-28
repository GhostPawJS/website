// ---------------------------------------------------------------------------
// Analyzer: social — Open Graph and Twitter Card meta tags
// ---------------------------------------------------------------------------

import { getMetaName, getMetaProperty, getTitle } from '../html_parser.ts';
import type { Analyzer, CheckResult, SiteContext } from '../types.ts';
import { fail, pass } from '../types.ts';

const DIMENSION = 'social';
const OG_REQUIRED = ['og:title', 'og:description', 'og:url', 'og:type'] as const;

export const social: Analyzer = {
	id: 'social',
	dimension: DIMENSION,
	weight: 8,
	applies: () => true,

	analyze(ctx: SiteContext): CheckResult[] {
		const results: CheckResult[] = [];

		for (const page of ctx.pages) {
			const { url, html } = page;

			// --- Required OG tags ---
			for (const prop of OG_REQUIRED) {
				const val = getMetaProperty(html, prop);
				if (!val) {
					results.push(
						fail({
							severity: 'error',
							dimension: DIMENSION,
							code: `og_missing_${prop.replace(':', '_')}`,
							message: `Missing <meta property="${prop}"> on page "${url}".`,
							page: url,
							fix: { file: page.file, action: 'set_frontmatter' },
						}),
					);
				} else {
					results.push(pass);
				}
			}

			// --- og:image (warning if missing — not always required) ---
			const ogImage = getMetaProperty(html, 'og:image');
			if (!ogImage) {
				results.push(
					fail({
						severity: 'warning',
						dimension: DIMENSION,
						code: 'og_missing_og_image',
						message: `Missing og:image on page "${url}". Social shares will have no image.`,
						page: url,
						fix: { file: page.file, action: 'set_frontmatter', field: 'og_image' },
					}),
				);
			} else {
				results.push(pass);
			}

			// --- OG title/description consistency with page title/description ---
			const ogTitle = getMetaProperty(html, 'og:title');
			const pageTitle = getTitle(html).trim();
			if (ogTitle && pageTitle && ogTitle !== pageTitle) {
				// Warn only on significant divergence (> 50% different)
				const shorter = Math.min(ogTitle.length, pageTitle.length);
				const divergence =
					Math.abs(ogTitle.length - pageTitle.length) / Math.max(ogTitle.length, pageTitle.length);
				if (divergence > 0.5 && shorter > 10) {
					results.push(
						fail({
							severity: 'info',
							dimension: DIMENSION,
							code: 'og_title_mismatch',
							message: `og:title significantly differs from <title>. Ensure consistency.`,
							page: url,
							current: ogTitle,
							expected: pageTitle,
						}),
					);
				} else {
					results.push(pass);
				}
			} else {
				results.push(pass);
			}

			// --- Twitter Card ---
			const twitterCard = getMetaName(html, 'twitter:card');
			if (!twitterCard) {
				results.push(
					fail({
						severity: 'warning',
						dimension: DIMENSION,
						code: 'twitter_card_missing',
						message: `Missing twitter:card meta tag on page "${url}".`,
						page: url,
					}),
				);
			} else {
				results.push(pass);
			}

			const twitterTitle = getMetaName(html, 'twitter:title');
			if (!twitterTitle) {
				results.push(
					fail({
						severity: 'info',
						dimension: DIMENSION,
						code: 'twitter_title_missing',
						message: `Missing twitter:title meta tag on page "${url}".`,
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
