import { stat } from 'node:fs/promises';
import { buildPageIndex } from '../content/page_index.ts';
import { walk } from '../fs/walk.ts';
import { computeSourceFingerprint, loadManifest } from '../project/manifest.ts';
import { resolvePaths } from '../project/paths.ts';
import { loadSiteConfig } from '../project/site_config.ts';
import { loadTemplates, renderPage } from '../render/render_page.ts';
import { loadDataFiles } from '../render/template_context.ts';
import type { BuildManifest, BuildResult, ContentPage } from '../types.ts';
import { cleanDist } from './clean.ts';
import {
	buildAndSaveManifest,
	copyAssets,
	removeStaleDistPages,
	writePages,
	writeSitemap,
} from './finalize.ts';

export interface BuildOptions {
	/** Skip cleaning dist before build (for incremental/watch use). */
	skipClean?: boolean;
	/**
	 * Only re-render pages whose source file changed since the last build.
	 * Falls back to a full rebuild if templates or data files changed, or if
	 * no previous manifest exists. Implies skipClean.
	 */
	incremental?: boolean;
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

	// 2. Discover + parse ALL pages (always — template context needs the full index)
	const [pages, templates, data] = await Promise.all([
		buildPageIndex(paths.content),
		loadTemplates(paths.templates),
		loadDataFiles(paths.data),
	]);

	const buildTimestamp = Date.now();
	const currentUrls = new Set(pages.map((p) => p.url));

	// 3. Determine render set (full vs incremental)
	let pagesToRender = pages;
	let prevManifest: BuildManifest | null = null;
	let sourceFingerprint = '';

	if (options.incremental) {
		const sourceFiles = await collectSourceFilePaths(paths.templates, paths.data);
		sourceFingerprint = await computeSourceFingerprint(sourceFiles);

		const loaded = await loadManifest(paths.buildManifest);
		const hasUsableManifest =
			loaded.sourceFingerprint !== '' && Object.keys(loaded.pages).length > 0;

		if (hasUsableManifest && loaded.sourceFingerprint === sourceFingerprint) {
			// Templates + data unchanged — only re-render content that changed.
			prevManifest = loaded;
			const pageMtimes = await collectPageMtimes(pages);
			pagesToRender = pages.filter((page) => {
				const prev = loaded.pages[page.url];
				if (!prev) return true; // new page
				const mtime = pageMtimes.get(page.url) ?? 0;
				return mtime > prev.mtime;
			});
		}
		// else: templates/data changed or no valid manifest → full rebuild (pagesToRender = pages)
	}

	const skipped = pages.length - pagesToRender.length;

	// 4. Render only the filtered set
	const renderedPages = await Promise.all(
		pagesToRender.map((page) => renderPage(page, config, pages, templates, data, buildTimestamp)),
	);

	// 5. Finalize
	const isIncremental = options.incremental && prevManifest !== null;
	if (!options.skipClean && !isIncremental) {
		await cleanDist(paths.dist);
	}
	await writePages(renderedPages, paths.dist);
	await writeSitemap(pages, paths.dist, config); // always uses full page index
	await copyAssets(paths.assets, paths.dist);
	if (isIncremental && prevManifest) {
		await removeStaleDistPages(prevManifest, currentUrls, paths.dist);
	}
	const manifestOpts = prevManifest
		? { sourceFingerprint, previous: prevManifest, allUrls: currentUrls }
		: { sourceFingerprint, allUrls: currentUrls };
	const manifest = await buildAndSaveManifest(
		renderedPages,
		paths.buildManifest,
		config,
		manifestOpts,
	);

	return {
		pages: renderedPages,
		skipped,
		manifest,
		fitness: null,
		duration: Date.now() - start,
	};
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Collect absolute paths of all template + data files for fingerprinting. */
async function collectSourceFilePaths(templatesDir: string, dataDir: string): Promise<string[]> {
	const filePaths: string[] = [];
	for (const dir of [templatesDir, dataDir]) {
		try {
			for await (const entry of walk(dir)) {
				filePaths.push(entry.path);
			}
		} catch {
			// Directory missing — skip.
		}
	}
	return filePaths;
}

/** Stat each page's source file to get its mtime (Unix ms). Returns Map<url, mtime>. */
async function collectPageMtimes(pages: ContentPage[]): Promise<Map<string, number>> {
	const entries = await Promise.all(
		pages.map(async (page) => {
			try {
				const s = await stat(page.file);
				return [page.url, s.mtimeMs] as const;
			} catch {
				return [page.url, 0] as const;
			}
		}),
	);
	return new Map(entries);
}
