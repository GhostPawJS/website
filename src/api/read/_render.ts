// ---------------------------------------------------------------------------
// Internal shared render helper.
// Builds rendered pages in memory without writing to dist/.
// Used by all read-namespace functions that need page content or TF-IDF data.
// ---------------------------------------------------------------------------

import { buildPageIndex } from '../../content/page_index.ts';
import { resolvePaths } from '../../project/paths.ts';
import { loadSiteConfig } from '../../project/site_config.ts';
import { loadTemplates, renderPage, type TemplateMap } from '../../render/render_page.ts';
import { loadDataFiles } from '../../render/template_context.ts';
import type { ContentPage, ProjectPaths, RenderedPage, SiteConfig } from '../../types.ts';

export interface RenderResult {
	pages: RenderedPage[];
	contentPages: ContentPage[];
	config: SiteConfig;
	paths: ProjectPaths;
	templates: TemplateMap;
	data: Record<string, unknown>;
}

/**
 * Discover, parse, and render all pages for a project directory.
 * Does NOT write to disk. Used as the internal primitive for all read operations.
 */
export async function renderAll(dir: string): Promise<RenderResult> {
	const paths = resolvePaths(dir);
	const config = await loadSiteConfig(paths.siteJson);

	const [contentPages, templates, data] = await Promise.all([
		buildPageIndex(paths.content),
		loadTemplates(paths.templates),
		loadDataFiles(paths.data),
	]);

	const buildTimestamp = Date.now();
	const pages = await Promise.all(
		contentPages.map((p) => renderPage(p, config, contentPages, templates, data, buildTimestamp)),
	);

	return { pages, contentPages, config, paths, templates, data };
}
