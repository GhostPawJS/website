import { buildSiteContext } from '../../fitness/context.ts';
import { buildTopicalClusters } from '../../fitness/runner.ts';
import type { SiteStructure } from '../../types.ts';
import { renderAll } from './_render.ts';

/**
 * Return the site's structural topology:
 * - `hierarchy` — URL → parent URL (null for homepage)
 * - `links` — URL → outgoing internal URLs
 * - `collections` — collection name → page URLs
 * - `clusters` — topical clusters derived from TF-IDF cosine similarity
 */
export async function getStructure(dir: string): Promise<SiteStructure> {
	const { pages, contentPages, config, paths } = await renderAll(dir);
	const ctx = await buildSiteContext(pages, config, paths);

	// Hierarchy: infer parent URL from URL segments
	const pageSet = ctx.pageSet;
	const hierarchy: Record<string, string | null> = {};
	for (const url of pageSet) {
		hierarchy[url] = inferParentUrl(url, pageSet);
	}

	// Links: outgoing internal links per page
	const links: Record<string, string[]> = {};
	for (const [url, targets] of ctx.linkGraph.outgoing) {
		links[url] = targets;
	}

	// Collections: group by collection name
	const collections: Record<string, string[]> = {};
	for (const cp of contentPages) {
		if (cp.collection) {
			const col = collections[cp.collection] ?? [];
			col.push(cp.url);
			collections[cp.collection] = col;
		}
	}

	const clusters = buildTopicalClusters(ctx);

	return { hierarchy, links, collections, clusters };
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/**
 * Infer the parent URL of `url` by walking up URL segments and matching
 * against known pages in `pageSet`.
 */
function inferParentUrl(url: string, pageSet: Set<string>): string | null {
	if (url === '/') return null;
	const segments = url.replace(/^\/|\/$/g, '').split('/');
	for (let i = segments.length - 1; i >= 0; i--) {
		const candidate = i === 0 ? '/' : `/${segments.slice(0, i).join('/')}/`;
		if (pageSet.has(candidate)) return candidate;
	}
	return '/';
}
