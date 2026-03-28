import { posix } from 'node:path';

/**
 * Convert a content-relative file path (POSIX) to a URL slug.
 *
 * Rules:
 * - Strip `.md` extension
 * - `_index` becomes `index`, so it takes over the directory URL
 * - `index` at root → slug "" (homepage)
 * - Underscores in path segments are normalized to hyphens (SEO: Google treats
 *   underscores as word-joiners, hyphens as word-separators)
 * - Everything else → relative path without extension
 *
 * Examples:
 *   "index.md"              → ""                 → "/"
 *   "about.md"              → "about"            → "/about/"
 *   "blog/_index.md"        → "blog"             → "/blog/"
 *   "blog/first-post.md"    → "blog/first-post"  → "/blog/first-post/"
 *   "my_page.md"            → "my-page"          → "/my-page/"
 */
export function fileToSlug(relativePath: string): string {
	// Normalize to POSIX
	const posixPath = relativePath.replace(/\\/g, '/');
	// Strip extension
	const noExt = posixPath.endsWith('.md') ? posixPath.slice(0, -3) : posixPath;
	// Resolve _index and index → parent directory slug
	const parts = noExt.split('/');
	const last = parts[parts.length - 1];
	if (last === '_index' || last === 'index') {
		parts.pop();
	}
	// Normalize underscores → hyphens in every segment
	const slug = parts.map((s) => s.replace(/_/g, '-')).join('/');
	return slug;
}

/**
 * Convert a slug to a public URL path.
 * Empty slug (homepage) → "/".
 * All other slugs → "/slug/".
 */
export function slugToUrl(slug: string): string {
	if (slug === '' || slug === 'index') return '/';
	return `/${slug}/`;
}

/**
 * Derive the collection name from a slug.
 * A page is "in" a collection if its slug has at least one directory segment.
 * The collection is the first directory segment.
 *
 * Examples:
 *   ""                → null   (homepage)
 *   "about"           → null   (root-level page)
 *   "blog/first-post" → "blog"
 *   "docs/api/fetch"  → "docs"
 */
export function slugToCollection(slug: string): string | null {
	const idx = slug.indexOf('/');
	if (idx === -1) return null;
	const segment = slug.slice(0, idx);
	return segment || null;
}

/**
 * Sanitize a user-supplied slug fragment: lowercase, hyphenate spaces and
 * underscores, remove characters outside [a-z0-9-/].
 */
export function sanitizeSlug(raw: string): string {
	return raw
		.toLowerCase()
		.replace(/[\s_]+/g, '-')
		.replace(/[^a-z0-9\-/]/g, '')
		.replace(/-{2,}/g, '-');
}

/**
 * Given a site base URL (e.g. "https://example.com") and a page URL path
 * (e.g. "/about/"), return the absolute canonical URL.
 * Trailing slashes are normalised: base has no trailing slash; path starts with "/".
 */
export function absoluteUrl(baseUrl: string, urlPath: string): string {
	const base = baseUrl.replace(/\/+$/, '');
	const path = urlPath.startsWith('/') ? urlPath : `/${urlPath}`;
	return `${base}${path}`;
}

/**
 * Sort comparator for content pages: collection index pages (`_index`) first
 * within their collection, then by `weight` ascending, then by url.
 */
export function pageOrder(
	a: { url: string; frontmatter: { weight?: number } },
	b: { url: string; frontmatter: { weight?: number } },
): number {
	const wa = a.frontmatter.weight ?? 100;
	const wb = b.frontmatter.weight ?? 100;
	if (wa !== wb) return wa - wb;
	return a.url < b.url ? -1 : a.url > b.url ? 1 : 0;
}

/**
 * Return the output file path for a page given its URL.
 * "/" → "index.html", "/about/" → "about/index.html", etc.
 */
export function urlToOutputFile(urlPath: string): string {
	if (urlPath === '/') return 'index.html';
	const slug = urlPath.replace(/^\/|\/$/g, '');
	return posix.join(slug, 'index.html');
}
