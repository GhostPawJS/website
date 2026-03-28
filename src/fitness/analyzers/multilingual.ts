// ---------------------------------------------------------------------------
// Analyzer: multilingual — International SEO / hreflang
//
// Validates hreflang tag correctness: absolute URLs, x-default presence,
// bidirectional linking, resolvable hrefs, and canonical consistency.
// Applies when hreflang tags are present or multiple languages configured.
// ---------------------------------------------------------------------------

import type { Analyzer, CheckResult, SiteContext } from '../types.ts';
import { fail, pass } from '../types.ts';

const DIMENSION = 'multilingual';

// Matches both attribute orderings of hreflang + href
const HREFLANG_RE =
	/<link[^>]+hreflang\s*=\s*["']([^"']*)["'][^>]+href\s*=\s*["']([^"']*)["']|<link[^>]+href\s*=\s*["']([^"']*)["'][^>]+hreflang\s*=\s*["']([^"']*)["']/gi;

// Canonical link
const CANONICAL_RE =
	/<link[^>]+rel\s*=\s*["']canonical["'][^>]+href\s*=\s*["']([^"']*)["']|<link[^>]+href\s*=\s*["']([^"']*)["'][^>]+rel\s*=\s*["']canonical["']/i;

interface HreflangDecl {
	lang: string;
	href: string;
	sourcePage: string;
}

function extractHreflangDecls(html: string, sourcePage: string): HreflangDecl[] {
	const decls: HreflangDecl[] = [];
	const re = new RegExp(HREFLANG_RE.source, 'gi');
	for (;;) {
		const m = re.exec(html);
		if (!m) break;
		// Group 1+2: hreflang-first; Group 3+4: href-first
		const lang = (m[1] ?? m[4] ?? '').trim();
		const href = (m[2] ?? m[3] ?? '').trim();
		if (lang && href) {
			decls.push({ lang, href, sourcePage });
		}
	}
	return decls;
}

function stripBase(href: string, siteUrl: string): string {
	try {
		const base = siteUrl.replace(/\/$/, '');
		if (href.startsWith(base)) {
			return href.slice(base.length) || '/';
		}
	} catch {
		// ignore
	}
	return href;
}

export const multilingual: Analyzer = {
	id: 'multilingual',
	dimension: DIMENSION,
	weight: 8,
	applies: (ctx) =>
		ctx.pages.some((p) => /<link[^>]+hreflang/i.test(p.html)) ||
		(Array.isArray(ctx.config.languages as unknown) &&
			(ctx.config.languages as unknown[]).length > 1),

	analyze(ctx: SiteContext): CheckResult[] {
		const results: CheckResult[] = [];
		const siteUrl = ctx.config.url.replace(/\/$/, '');

		// Collect all hreflang declarations across all pages
		const allDecls: HreflangDecl[] = [];
		for (const page of ctx.pages) {
			const decls = extractHreflangDecls(page.html, page.url);
			allDecls.push(...decls);
		}

		if (allDecls.length === 0) return results;

		// Build a map: sourcePage -> Set of target hrefs declared
		const declsBySource = new Map<string, Set<string>>();
		for (const decl of allDecls) {
			let set = declsBySource.get(decl.sourcePage);
			if (!set) {
				set = new Set();
				declsBySource.set(decl.sourcePage, set);
			}
			set.add(decl.href);
		}

		for (const page of ctx.pages) {
			const { url, html } = page;
			const decls = extractHreflangDecls(html, url);
			if (decls.length === 0) continue;

			// 1. hreflang_absolute — all hrefs must be absolute
			for (const decl of decls) {
				const isAbsolute = decl.href.startsWith('http://') || decl.href.startsWith('https://');
				if (!isAbsolute) {
					results.push(
						fail({
							severity: 'error',
							dimension: DIMENSION,
							code: 'hreflang_relative',
							message: `hreflang on "${url}" has a relative href "${decl.href}" — hreflang URLs must be absolute.`,
							page: url,
							element: `hreflang="${decl.lang}"`,
							current: decl.href,
							expected: `${siteUrl}${decl.href.startsWith('/') ? '' : '/'}${decl.href}`,
							fix: { file: page.file, action: 'update_template' },
						}),
					);
				} else {
					results.push(pass);
				}
			}

			// 2. hreflang_xdefault — homepage should declare x-default
			if (url === '/' || url === '') {
				const hasXDefault = decls.some((d) => d.lang === 'x-default');
				if (!hasXDefault) {
					results.push(
						fail({
							severity: 'warning',
							dimension: DIMENSION,
							code: 'hreflang_xdefault',
							message: `Homepage "${url}" has hreflang declarations but no x-default — add <link rel="alternate" hreflang="x-default"> to indicate the fallback language.`,
							page: url,
							fix: { file: page.file, action: 'update_template' },
						}),
					);
				} else {
					results.push(pass);
				}
			}

			// 3. hreflang_resolves — each href should exist in pageSet
			for (const decl of decls) {
				if (decl.lang === 'x-default') continue;
				const path = stripBase(decl.href, siteUrl);
				const exists =
					ctx.pageSet.has(path) ||
					ctx.pageSet.has(`${path}/`) ||
					ctx.pageSet.has(path.replace(/\/$/, ''));
				if (!exists) {
					results.push(
						fail({
							severity: 'warning',
							dimension: DIMENSION,
							code: 'hreflang_dead_link',
							message: `hreflang on "${url}" points to "${decl.href}" (lang="${decl.lang}") which doesn't match any known page.`,
							page: url,
							element: `hreflang="${decl.lang}"`,
							current: decl.href,
							fix: { file: page.file, action: 'update_template' },
						}),
					);
				} else {
					results.push(pass);
				}
			}

			// 4. hreflang_bidirectional — for each target page B declared in A,
			//    B should also declare A in its hreflang tags
			for (const decl of decls) {
				if (decl.lang === 'x-default') continue;
				const targetPath = stripBase(decl.href, siteUrl);
				// Find the target page
				const targetPage = ctx.pages.find(
					(p) => p.url === targetPath || p.url === `${targetPath}/`,
				);
				if (!targetPage) continue;

				const targetDecls = extractHreflangDecls(targetPage.html, targetPage.url);
				// Target page should declare back to the source page
				const sourceAbsolute = `${siteUrl}${url.startsWith('/') ? '' : '/'}${url}`;
				const declaresBack = targetDecls.some(
					(d) =>
						d.href === sourceAbsolute ||
						d.href === `${siteUrl}${url}` ||
						stripBase(d.href, siteUrl) === url ||
						stripBase(d.href, siteUrl) === `${url}/`,
				);
				if (!declaresBack) {
					results.push(
						fail({
							severity: 'warning',
							dimension: DIMENSION,
							code: 'hreflang_not_bidirectional',
							message: `Page "${url}" declares hreflang pointing to "${decl.href}" but that page does not reciprocate — hreflang must be bidirectional.`,
							page: url,
							element: `hreflang="${decl.lang}"`,
							fix: { file: targetPage.file, action: 'update_template' },
						}),
					);
				} else {
					results.push(pass);
				}
			}

			// 5. canonical_language — canonical should not point to a different language variant
			const canonicalMatch = CANONICAL_RE.exec(html);
			if (canonicalMatch) {
				const canonicalHref = (canonicalMatch[1] ?? canonicalMatch[2] ?? '').trim();
				if (canonicalHref) {
					const canonicalPath = stripBase(canonicalHref, siteUrl);
					// If canonical points away from this page entirely, check if it's a different lang variant
					if (
						canonicalPath !== url &&
						canonicalPath !== `${url}/` &&
						canonicalPath !== url.replace(/\/$/, '')
					) {
						// Check if the canonical target has hreflang declarations that include the current page
						// as a different language — this indicates canonical crosses language boundary
						const canonicalTarget = ctx.pages.find(
							(p) => p.url === canonicalPath || p.url === `${canonicalPath}/`,
						);
						if (canonicalTarget) {
							const targetDecls = extractHreflangDecls(canonicalTarget.html, canonicalTarget.url);
							const currentInTargetHreflang = targetDecls.some((d) => {
								const dPath = stripBase(d.href, siteUrl);
								return dPath === url || dPath === `${url}/`;
							});
							if (currentInTargetHreflang) {
								results.push(
									fail({
										severity: 'error',
										dimension: DIMENSION,
										code: 'canonical_crosses_language',
										message: `Page "${url}" has a canonical pointing to "${canonicalHref}" which is a different language variant — canonical should not cross language boundaries.`,
										page: url,
										current: canonicalHref,
										expected: `${siteUrl}${url}`,
										fix: { file: page.file, action: 'update_template' },
									}),
								);
							} else {
								results.push(pass);
							}
						}
					}
				}
			}
		}

		return results;
	},
};
