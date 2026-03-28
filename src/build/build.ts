import { buildPageIndex } from '../content/page_index.ts';
import { resolvePaths } from '../project/paths.ts';
import { loadSiteConfig } from '../project/site_config.ts';
import { loadTemplates, renderPage } from '../render/render_page.ts';
import { loadDataFiles } from '../render/template_context.ts';
import type { BuildResult, RenderedPage } from '../types.ts';
import { cleanDist } from './clean.ts';
import { buildAndSaveManifest, copyAssets, writePages, writeSitemap } from './finalize.ts';

export interface BuildOptions {
	/** Skip cleaning dist before build (for incremental/watch use). */
	skipClean?: boolean;
}

/**
 * Run the full build pipeline for a project directory.
 *
 * Steps:
 * 1. Discover: scan content/, templates/, assets/, data/
 * 2. Parse: frontmatter, page index, collections
 * 3. Render: markdown → HTML, layout chain, auto-inject
 * 4. Finalize: write dist/, sitemap.xml, copy assets, save manifest
 *
 * Returns a `BuildResult` (fitness is always `null` — run `fitness()` separately).
 */
export async function build(projectDir: string, options: BuildOptions = {}): Promise<BuildResult> {
	const start = Date.now();
	const paths = resolvePaths(projectDir);

	// 1. Load config
	const config = await loadSiteConfig(paths.siteJson);

	// 2. Discover + parse
	const [pages, templates, data] = await Promise.all([
		buildPageIndex(paths.content),
		loadTemplates(paths.templates),
		loadDataFiles(paths.data),
	]);

	// 3. Render all pages
	const buildTimestamp = Date.now();
	const renderedPages: RenderedPage[] = await Promise.all(
		pages.map((page) => renderPage(page, config, pages, templates, data, buildTimestamp)),
	);

	// 4. Finalize
	if (!options.skipClean) {
		await cleanDist(paths.dist);
	}
	await writePages(renderedPages, paths.dist);
	await writeSitemap(renderedPages, paths.dist, config);
	await copyAssets(paths.assets, paths.dist);
	const manifest = await buildAndSaveManifest(renderedPages, paths.buildManifest, config);

	return {
		pages: renderedPages,
		manifest,
		fitness: null,
		duration: Date.now() - start,
	};
}
