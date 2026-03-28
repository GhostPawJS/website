import { rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { absoluteUrl } from '../content/url_routing.ts';
import { copyDir } from '../fs/copy_dir.ts';
import { hashContent } from '../fs/hash_file.ts';
import { writeFile } from '../fs/write_file.ts';
import { saveManifest } from '../project/manifest.ts';
import type { BuildManifest, PageFrontmatter, RenderedPage, SiteConfig } from '../types.ts';

/**
 * Write all rendered pages to `distDir`.
 * Each page is written to `distDir/<outputPath>/index.html` (or `index.html`
 * for the homepage).
 */
export async function writePages(pages: RenderedPage[], distDir: string): Promise<void> {
	await Promise.all(
		pages.map(async (page) => {
			const outputPath =
				page.url === '/' ? 'index.html' : join(page.url.replace(/^\/|\/$/g, ''), 'index.html');
			await writeFile(join(distDir, outputPath), page.html);
		}),
	);
}

/**
 * Generate `sitemap.xml` from the page index and write it to `distDir/sitemap.xml`.
 * Only indexable pages (noindex !== true) are included.
 * Accepts any page-like objects with `url` and `frontmatter` fields.
 */
export async function writeSitemap(
	pages: Array<{ url: string; frontmatter: PageFrontmatter }>,
	distDir: string,
	config: SiteConfig,
): Promise<void> {
	const indexablePages = pages.filter((p) => !p.frontmatter.noindex);
	const items = indexablePages
		.map((p) => {
			const loc = absoluteUrl(config.url, p.url);
			const lastmod = p.frontmatter.dateModified ?? p.frontmatter.date ?? '';
			const lastmodTag = lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : '';
			return `  <url>\n    <loc>${loc}</loc>${lastmodTag}\n  </url>`;
		})
		.join('\n');

	const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</urlset>\n`;
	await writeFile(join(distDir, 'sitemap.xml'), xml);
}

/**
 * Copy all asset files from `assetsDir` to `distDir` preserving paths.
 */
export async function copyAssets(assetsDir: string, distDir: string): Promise<number> {
	return copyDir(assetsDir, distDir);
}

export interface ManifestBuildOptions {
	/** SHA-256 fingerprint of template + data files. */
	sourceFingerprint?: string;
	/** Previous manifest to merge unchanged page entries from (incremental mode). */
	previous?: BuildManifest;
	/** All current page URLs — entries absent from this set are dropped. */
	allUrls?: Set<string>;
}

/**
 * Build and save the build manifest.
 *
 * In incremental mode (`opts.previous` + `opts.allUrls` provided):
 * - starts from previous entries
 * - removes entries for deleted pages (not in allUrls)
 * - overlays newly rendered pages
 */
export async function buildAndSaveManifest(
	pages: RenderedPage[],
	manifestPath: string,
	config: SiteConfig,
	opts: ManifestBuildOptions = {},
): Promise<BuildManifest> {
	const timestamp = Date.now();
	const manifest: BuildManifest = {
		version: 1,
		timestamp,
		sourceFingerprint: opts.sourceFingerprint ?? '',
		pages: {},
	};

	// Seed with previous entries (incremental merge).
	if (opts.previous && opts.allUrls) {
		for (const [url, entry] of Object.entries(opts.previous.pages)) {
			if (opts.allUrls.has(url)) {
				manifest.pages[url] = entry;
			}
			// Entries not in allUrls are deleted pages — omit them.
		}
	}

	// Overlay newly rendered pages.
	for (const page of pages) {
		let mtime = timestamp;
		try {
			const s = await stat(page.file);
			mtime = s.mtimeMs;
		} catch {
			// file not found — use build timestamp
		}
		manifest.pages[page.url] = {
			hash: hashContent(page.html),
			mtime,
			url: absoluteUrl(config.url, page.url),
		};
	}

	await saveManifest(manifestPath, manifest);
	return manifest;
}

/**
 * Remove dist/ output files for pages that existed in the previous manifest
 * but are no longer in the current page set (deleted source pages).
 */
export async function removeStaleDistPages(
	prevManifest: BuildManifest,
	currentUrls: Set<string>,
	distDir: string,
): Promise<void> {
	const staleUrls = Object.keys(prevManifest.pages).filter((url) => !currentUrls.has(url));
	await Promise.all(
		staleUrls.map(async (url) => {
			const outputPath =
				url === '/' ? 'index.html' : join(url.replace(/^\/|\/$/g, ''), 'index.html');
			try {
				await rm(join(distDir, outputPath));
			} catch {
				// Already gone — ignore.
			}
		}),
	);
}
