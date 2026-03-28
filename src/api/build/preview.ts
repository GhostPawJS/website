import { SiteError } from '../../errors.ts';
import type { RenderedPage } from '../../types.ts';
import { renderAll } from '../read/_render.ts';

/**
 * Render a single page in memory without writing to `dist/`.
 * Useful for fast single-page previews during editing.
 *
 * `path` accepts a URL path, slug, or content-relative file path.
 * Throws `SiteError('not_found')` when no matching page exists.
 */
export async function preview(dir: string, path: string): Promise<RenderedPage> {
	const { pages, contentPages } = await renderAll(dir);

	const idx = pages.findIndex(
		(rp, i) =>
			rp.url === path ||
			contentPages[i]?.slug === path ||
			contentPages[i]?.file === path ||
			rp.file.endsWith(path),
	);

	if (idx === -1) throw new SiteError('not_found', `Page not found: "${path}"`);
	return pages[idx] as (typeof pages)[number];
}
