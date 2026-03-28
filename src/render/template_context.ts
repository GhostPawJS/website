import { buildCollectionsContext } from '../content/collections.ts';
import { isSiteError } from '../errors.ts';
import { readFile } from '../fs/read_file.ts';
import { walk } from '../fs/walk.ts';
import type { ContentPage, SiteConfig } from '../types.ts';

/**
 * Load all JSON files from `dataDir` and return them as a flat object keyed
 * by filename without extension (e.g. `nav.json` → `data.nav`).
 * Missing or empty data directory is treated as an empty object.
 */
export async function loadDataFiles(dataDir: string): Promise<Record<string, unknown>> {
	const data: Record<string, unknown> = {};
	try {
		for await (const entry of walk(dataDir, (e) => e.relative.endsWith('.json'))) {
			const key = entry.relative.replace(/\.json$/, '').replace(/\//g, '_');
			try {
				const raw = await readFile(entry.path);
				data[key] = JSON.parse(raw);
			} catch {
				// malformed JSON — skip
			}
		}
	} catch (err) {
		if (isSiteError(err) && err.code === 'not_found') return data;
		// ENOENT from walk — directory doesn't exist, return empty
	}
	return data;
}

/**
 * Build the full template context for a single page render.
 *
 * Priority (highest → lowest):
 * 1. Page frontmatter
 * 2. Data files (`data.*`)
 * 3. Site config (`site.*`)
 * 4. Computed values (`page.*`, `build.*`, `collections.*`)
 */
export function buildTemplateContext(
	page: ContentPage,
	config: SiteConfig,
	allPages: ContentPage[],
	data: Record<string, unknown>,
	buildTimestamp: number,
): Record<string, unknown> {
	const collections = buildCollectionsContext(allPages);

	return {
		// Computed page values
		page: {
			url: page.url,
			slug: page.slug,
			collection: page.collection,
			...page.frontmatter,
		},
		// Site config
		site: config,
		// Data files
		data,
		// Collection lists (for listing templates)
		collections,
		// Build metadata
		build: {
			timestamp: buildTimestamp,
			year: new Date(buildTimestamp).getFullYear(),
		},
	};
}
