// ---------------------------------------------------------------------------
// Analyzer: links — Internal link graph analysis
// Checks: broken links, orphans, crawl depth, anchor text, self-links, noopener
// ---------------------------------------------------------------------------

import { getLinks } from '../html_parser.ts';
import type { Analyzer, CheckResult, SiteContext } from '../types.ts';
import { fail, pass } from '../types.ts';

const DIMENSION = 'links';
const MAX_CRAWL_DEPTH = 3;
const GENERIC_ANCHORS = new Set([
	'click here',
	'read more',
	'here',
	'learn more',
	'more',
	'link',
	'this',
]);

export const links: Analyzer = {
	id: 'links',
	dimension: DIMENSION,
	weight: 10,
	applies: () => true,

	analyze(ctx: SiteContext): CheckResult[] {
		const results: CheckResult[] = [];
		const { linkGraph, pageSet } = ctx;

		// --- Site-level: orphan pages ---
		if (linkGraph.orphans.length > 0) {
			for (const orphanUrl of linkGraph.orphans) {
				results.push(
					fail({
						severity: 'warning',
						dimension: DIMENSION,
						code: 'page_orphan',
						message: `Page "${orphanUrl}" has no incoming internal links.`,
						page: orphanUrl,
						fix: { file: '', action: 'add_content' },
					}),
				);
			}
		} else {
			results.push(pass);
		}

		// --- Per-page checks ---
		for (const page of ctx.pages) {
			const { url, html } = page;
			const rawLinks = getLinks(html);

			// --- Broken internal links ---
			let brokenFound = false;
			for (const link of rawLinks) {
				const { href } = link;
				if (
					!href ||
					href.startsWith('#') ||
					href.startsWith('http') ||
					href.startsWith('mailto:') ||
					href.startsWith('tel:')
				) {
					continue;
				}
				// Root-relative internal link
				const targetUrl = normalizeUrl(href, url);
				if (targetUrl && !pageSet.has(targetUrl) && !hasExtension(targetUrl)) {
					results.push(
						fail({
							severity: 'error',
							dimension: DIMENSION,
							code: 'broken_internal_link',
							message: `Broken internal link "${href}" on page "${url}".`,
							page: url,
							element: href,
							fix: { file: page.file, action: 'update_content' },
						}),
					);
					brokenFound = true;
				}
			}
			if (!brokenFound) results.push(pass);

			// --- Crawl depth ---
			const depth = linkGraph.depth.get(url) ?? Infinity;
			if (depth > MAX_CRAWL_DEPTH) {
				results.push(
					fail({
						severity: 'warning',
						dimension: DIMENSION,
						code: 'crawl_depth_exceeded',
						message: `Page "${url}" is ${depth === Infinity ? 'unreachable' : `${depth} clicks`} from the homepage (max ${MAX_CRAWL_DEPTH}).`,
						page: url,
						current: depth === Infinity ? 'unreachable' : String(depth),
						expected: `≤ ${MAX_CRAWL_DEPTH} clicks`,
					}),
				);
			} else {
				results.push(pass);
			}

			// --- Self-referential links ---
			const selfLinks = rawLinks.filter((l) => {
				if (!l.href || l.href.startsWith('#')) return false;
				const normalized = normalizeUrl(l.href, url);
				return normalized === url;
			});
			if (selfLinks.length > 0) {
				results.push(
					fail({
						severity: 'info',
						dimension: DIMENSION,
						code: 'self_referential_link',
						message: `Page "${url}" links to itself.`,
						page: url,
					}),
				);
			} else {
				results.push(pass);
			}

			// --- Anchor text quality ---
			for (const link of rawLinks) {
				const text = link.text.toLowerCase().trim();
				if (GENERIC_ANCHORS.has(text)) {
					results.push(
						fail({
							severity: 'warning',
							dimension: DIMENSION,
							code: 'anchor_text_generic',
							message: `Generic anchor text "${link.text}" on page "${url}".`,
							page: url,
							element: link.href,
							current: link.text,
							fix: { file: page.file, action: 'update_content' },
						}),
					);
				} else {
					results.push(pass);
				}
			}

			// --- External links: noopener when target=_blank ---
			for (const link of rawLinks) {
				if (link.target === '_blank') {
					const rel = link.rel.toLowerCase();
					if (!rel.includes('noopener') && !rel.includes('noreferrer')) {
						results.push(
							fail({
								severity: 'warning',
								dimension: DIMENSION,
								code: 'external_link_no_noopener',
								message: `External link "${link.href}" has target="_blank" without rel="noopener".`,
								page: url,
								element: link.href,
								fix: { file: page.file, action: 'update_content' },
							}),
						);
					} else {
						results.push(pass);
					}
				}
			}
		}

		return results;
	},
};

function normalizeUrl(href: string, pageUrl: string): string {
	if (href.startsWith('/')) {
		const clean = href.split('?')[0]?.split('#')[0] ?? href;
		return clean.endsWith('/') ? clean : `${clean}/`;
	}
	// Relative resolution (simplified)
	const base = pageUrl.endsWith('/') ? pageUrl : `${pageUrl}/`;
	const resolved = (base + href).replace(/\/\.\//g, '/').replace(/[^/]+\/\.\.\//g, '');
	return resolved.endsWith('/') ? resolved : `${resolved}/`;
}

function hasExtension(url: string): boolean {
	const last = url.split('/').pop() ?? '';
	return last.includes('.');
}
