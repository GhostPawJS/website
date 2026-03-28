import type { ContentPage } from '../types.ts';

export interface Collection {
	name: string;
	/** The `_index.md` page for this collection, if it exists. */
	index: ContentPage | null;
	/** All non-index pages in this collection, sorted by pageOrder. */
	pages: ContentPage[];
}

/**
 * Group content pages into named collections by their `collection` property.
 * Pages without a collection (root-level) are grouped under the key `""`.
 *
 * The returned map's keys are collection names (including `""` for root).
 */
export function groupByCollection(pages: ContentPage[]): Map<string, Collection> {
	const map = new Map<string, Collection>();

	for (const page of pages) {
		const key = page.collection ?? '';

		if (!map.has(key)) {
			map.set(key, { name: key, index: null, pages: [] });
		}
		const col = map.get(key);
		if (!col) continue;

		// A collection index page has a slug equal to the collection name
		// (e.g. slug "blog" for collection "blog")
		if (page.slug === key) {
			col.index = page;
		} else {
			col.pages.push(page);
		}
	}

	return map;
}

/**
 * Build the `collections` template context object.
 * Shape: `{ blog: [{ url, title, date, description, ... }, ...], ... }`
 *
 * Each collection becomes an array of summary objects suitable for
 * iteration in templates (e.g. `{{#each collections.blog as post}}`).
 */
export function buildCollectionsContext(pages: ContentPage[]): Record<string, unknown[]> {
	const grouped = groupByCollection(pages);
	const ctx: Record<string, unknown[]> = {};

	for (const [key, col] of grouped) {
		if (key === '') continue; // skip root
		// Sort newest-first by datePublished (falling back to date), then by title for stable order
		const sorted = [...col.pages].sort((a, b) => {
			const da = String(a.frontmatter.datePublished ?? a.frontmatter.date ?? '');
			const db = String(b.frontmatter.datePublished ?? b.frontmatter.date ?? '');
			return (
				db.localeCompare(da) ||
				String(a.frontmatter.title ?? '').localeCompare(String(b.frontmatter.title ?? ''))
			);
		});
		ctx[key] = sorted.map((p) => ({
			url: p.url,
			slug: p.slug,
			title: p.frontmatter.title ?? '',
			description: p.frontmatter.description ?? '',
			date: p.frontmatter.date ?? '',
			datePublished: p.frontmatter.datePublished ?? p.frontmatter.date ?? '',
			dateModified: p.frontmatter.dateModified ?? '',
			author: p.frontmatter.author ?? '',
			keyword: p.frontmatter.keyword ?? '',
			og_image: p.frontmatter.og_image ?? p.frontmatter.image ?? '',
		}));
	}

	return ctx;
}
