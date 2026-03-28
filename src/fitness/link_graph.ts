// ---------------------------------------------------------------------------
// Link graph: extract all links from rendered HTML, classify, build adjacency
// map, compute BFS crawl depths from homepage, detect orphan pages.
// ---------------------------------------------------------------------------

import { getLinks } from './html_parser.ts';

export interface LinkGraph {
	/** page url → outgoing internal page urls (deduplicated). */
	outgoing: Map<string, string[]>;
	/** page url → incoming internal page urls (deduplicated). */
	incoming: Map<string, string[]>;
	/** page url → outgoing external urls. */
	externalLinks: Map<string, string[]>;
	/**
	 * page url → target url → anchor texts used for that link.
	 * Useful for anchor text diversity checks.
	 */
	anchorTexts: Map<string, Map<string, string[]>>;
	/** page url → BFS depth from homepage ("/"). Infinity if unreachable. */
	depth: Map<string, number>;
	/** Page URLs that have zero incoming internal links (excluding homepage). */
	orphans: string[];
}

export interface LinkGraphInput {
	url: string;
	html: string;
}

/**
 * Build a link graph from rendered page HTML.
 *
 * @param pages   All pages with their rendered HTML.
 * @param siteUrl Base URL of the site (e.g. "https://example.com") used to
 *                classify absolute links as internal or external.
 */
export function buildLinkGraph(pages: LinkGraphInput[], siteUrl: string): LinkGraph {
	const pageSet = new Set(pages.map((p) => p.url));
	const origin = extractOrigin(siteUrl);

	const outgoing = new Map<string, string[]>();
	const incoming = new Map<string, string[]>();
	const externalLinks = new Map<string, string[]>();
	const anchorTexts = new Map<string, Map<string, string[]>>();

	// Initialise maps for every page
	for (const p of pages) {
		outgoing.set(p.url, []);
		incoming.set(p.url, []);
		externalLinks.set(p.url, []);
		anchorTexts.set(p.url, new Map());
	}

	// Extract and classify links per page
	for (const page of pages) {
		const links = getLinks(page.html);
		const seenInternal = new Set<string>();
		const seenExternal = new Set<string>();

		for (const link of links) {
			const { href, text, rel, target } = link;
			if (
				!href ||
				href.startsWith('#') ||
				href.startsWith('mailto:') ||
				href.startsWith('tel:') ||
				href.startsWith('javascript:')
			) {
				continue;
			}

			const classification = classifyHref(href, page.url, origin);

			if (classification.type === 'external') {
				if (!seenExternal.has(href)) {
					seenExternal.add(href);
					externalLinks.get(page.url)?.push(href);
				}
				continue;
			}

			// Internal link
			if (classification.type === 'skip') continue;
			const targetUrl = classification.normalizedUrl;
			if (!targetUrl || targetUrl === page.url) continue; // skip self-links (we track them separately)

			// Record anchor text (even for duplicates, as diversity matters)
			const pageAnchor = anchorTexts.get(page.url) as Map<string, string[]>;
			const existing = pageAnchor.get(targetUrl) ?? [];
			if (text) existing.push(text);
			pageAnchor.set(targetUrl, existing);

			if (seenInternal.has(targetUrl)) continue;
			seenInternal.add(targetUrl);

			outgoing.get(page.url)?.push(targetUrl);

			// Only record incoming links for pages that exist in our site
			if (pageSet.has(targetUrl)) {
				incoming.get(targetUrl)?.push(page.url);
			}

			// Suppress unused vars
			void rel;
			void target;
		}
	}

	// BFS crawl depth from homepage
	const depth = bfsCrawlDepth(outgoing, '/');

	// Orphan detection: pages with no incoming links (excluding homepage)
	const orphans: string[] = [];
	for (const [url, incomingList] of incoming) {
		if (url !== '/' && incomingList.length === 0) {
			orphans.push(url);
		}
	}
	orphans.sort();

	return { outgoing, incoming, externalLinks, anchorTexts, depth, orphans };
}

// ---------------------------------------------------------------------------
// BFS crawl depth
// ---------------------------------------------------------------------------

/**
 * BFS from `startUrl` through the adjacency map.
 * Returns a Map of url → depth. Pages not reachable get Infinity.
 */
export function bfsCrawlDepth(
	outgoing: Map<string, string[]>,
	startUrl: string,
): Map<string, number> {
	const depth = new Map<string, number>();
	const queue: Array<[string, number]> = [[startUrl, 0]];
	depth.set(startUrl, 0);

	while (queue.length > 0) {
		const entry = queue.shift();
		if (!entry) break;
		const [url, d] = entry;
		for (const target of outgoing.get(url) ?? []) {
			if (!depth.has(target)) {
				depth.set(target, d + 1);
				queue.push([target, d + 1]);
			}
		}
	}

	// Mark any page with no recorded depth as Infinity (unreachable)
	for (const url of outgoing.keys()) {
		if (!depth.has(url)) depth.set(url, Infinity);
	}

	return depth;
}

// ---------------------------------------------------------------------------
// Link classification
// ---------------------------------------------------------------------------

type Classification =
	| { type: 'external' }
	| { type: 'skip' }
	| { type: 'internal'; normalizedUrl: string };

function classifyHref(href: string, pageUrl: string, siteOrigin: string): Classification {
	if (href.startsWith('http://') || href.startsWith('https://')) {
		const linkOrigin = extractOrigin(href);
		if (linkOrigin === siteOrigin) {
			// Absolute internal link
			const path = extractPath(href);
			return { type: 'internal', normalizedUrl: normalizePath(path) };
		}
		return { type: 'external' };
	}

	// Protocol-relative
	if (href.startsWith('//')) {
		return { type: 'external' };
	}

	// Root-relative
	if (href.startsWith('/')) {
		return { type: 'internal', normalizedUrl: normalizePath(href) };
	}

	// Relative — resolve against page URL
	try {
		const resolved = resolveRelative(href, pageUrl);
		return { type: 'internal', normalizedUrl: normalizePath(resolved) };
	} catch {
		return { type: 'skip' };
	}
}

/** Ensure a URL path ends with "/" (directory-style URLs). */
function normalizePath(path: string): string {
	// Strip query and hash
	const clean = path.split('?')[0]?.split('#')[0] ?? path;
	if (clean === '') return '/';
	if (clean === '/') return '/';
	// Files with extensions don't get trailing slash
	const last = clean.split('/').pop() ?? '';
	if (last.includes('.')) return clean;
	return clean.endsWith('/') ? clean : `${clean}/`;
}

/** Extract just the pathname from a URL string. */
function extractPath(url: string): string {
	try {
		return new URL(url).pathname;
	} catch {
		return url;
	}
}

/** Extract the origin (scheme + host + port) from a URL. */
function extractOrigin(url: string): string {
	try {
		return new URL(url).origin;
	} catch {
		return url;
	}
}

/**
 * Resolve a relative href against a page's URL path.
 * Handles `./`, `../` and bare relative paths.
 */
function resolveRelative(href: string, pageUrl: string): string {
	// Use the page URL as base directory
	const base = pageUrl.endsWith('/') ? pageUrl : pageUrl.slice(0, pageUrl.lastIndexOf('/') + 1);
	const parts = (base + href).split('/');
	const resolved: string[] = [];
	for (const part of parts) {
		if (part === '..') {
			resolved.pop();
		} else if (part !== '.') {
			resolved.push(part);
		}
	}
	return resolved.join('/') || '/';
}
