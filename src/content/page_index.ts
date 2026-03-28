import { walk } from '../fs/walk.ts';
import type { ContentPage } from '../types.ts';
import { parsePage } from './parse_page.ts';
import { pageOrder } from './url_routing.ts';

/**
 * Discover and parse all `.md` files in `contentDir`.
 * Returns pages sorted by the canonical page order (weight, then URL).
 *
 * @param contentDir  Absolute path to the content directory.
 */
export async function buildPageIndex(contentDir: string): Promise<ContentPage[]> {
	const pages: ContentPage[] = [];
	for await (const entry of walk(contentDir, (e) => e.relative.endsWith('.md'))) {
		const page = await parsePage(entry.path, entry.relative);
		pages.push(page);
	}
	pages.sort(pageOrder);
	return pages;
}
