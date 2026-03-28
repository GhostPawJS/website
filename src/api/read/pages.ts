import { SiteError } from '../../errors.ts';
import { buildSiteContext } from '../../fitness/context.ts';
import { computePageScores } from '../../fitness/score.ts';
import type { PageDetail, PageFilter, PageSummary } from '../../types.ts';
import { renderAll } from './_render.ts';

/**
 * Return a summary of every page in the project.
 * Includes frontmatter, word count, readability, and collection.
 * Optionally filter by collection name or URL prefix.
 */
export async function listPages(dir: string, filter?: PageFilter): Promise<PageSummary[]> {
	const { pages, contentPages, config, paths } = await renderAll(dir);
	const ctx = await buildSiteContext(pages, config, paths);
	const pageScores = computePageScores(ctx, []);

	const summaries: PageSummary[] = pages.map((rp, i) => {
		const cp = contentPages[i];
		const ps = pageScores[rp.url];
		return {
			path: cp ? relativeFilePath(cp.file, paths.root) : rp.file,
			url: rp.url,
			frontmatter: rp.frontmatter,
			wordCount: rp.wordCount,
			readability: ps?.readability ?? emptyReadability(),
			collection: cp?.collection ?? null,
		};
	});

	let result = summaries;
	if (filter?.collection !== undefined) {
		result = result.filter((s) => s.collection === filter.collection);
	}
	if (filter?.url !== undefined) {
		const prefix = filter.url;
		result = result.filter((s) => s.url.startsWith(prefix));
	}
	return result;
}

/**
 * Return full detail for a single page: source markdown, rendered HTML, and
 * TF-IDF top terms in addition to everything in PageSummary.
 *
 * `path` accepts:
 *  - A relative file path (e.g. `"content/blog/post.md"`)
 *  - A slug (e.g. `"blog/post"`)
 *  - A URL path (e.g. `"/blog/post/"`)
 *
 * Throws `SiteError('not_found')` when no matching page is found.
 */
export async function getPage(dir: string, path: string): Promise<PageDetail> {
	const { pages, contentPages, config, paths } = await renderAll(dir);
	const ctx = await buildSiteContext(pages, config, paths);
	const pageScores = computePageScores(ctx, []);

	// Match by file path suffix, slug, or URL
	const idx = pages.findIndex(
		(rp, i) =>
			rp.url === path ||
			contentPages[i]?.slug === path ||
			contentPages[i]?.file === path ||
			rp.file.endsWith(path),
	);

	if (idx === -1) {
		throw new SiteError('not_found', `Page not found: "${path}"`);
	}

	const rp = pages[idx] as (typeof pages)[number];
	const cp = contentPages[idx];
	const ps = pageScores[rp.url];
	const topTerms = ctx.tfidf.vectors.get(rp.url)?.topTerms ?? [];

	return {
		path: cp ? relativeFilePath(cp.file, paths.root) : rp.file,
		url: rp.url,
		frontmatter: rp.frontmatter,
		wordCount: rp.wordCount,
		readability: ps?.readability ?? emptyReadability(),
		collection: cp?.collection ?? null,
		markdown: cp?.body ?? '',
		html: rp.html,
		tfidfTopTerms: topTerms,
	};
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeFilePath(absolutePath: string, root: string): string {
	return absolutePath.startsWith(`${root}/`) ? absolutePath.slice(root.length + 1) : absolutePath;
}

function emptyReadability() {
	return {
		fleschReadingEase: 0,
		fleschKincaidGrade: 0,
		gunningFog: 0,
		avgSentenceLength: 0,
		avgSyllablesPerWord: 0,
	};
}
