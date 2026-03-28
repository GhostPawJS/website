import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { absoluteUrl } from '../content/url_routing.ts';
import { copyDir } from '../fs/copy_dir.ts';
import { hashContent } from '../fs/hash_file.ts';
import { writeFile } from '../fs/write_file.ts';
import { saveManifest } from '../project/manifest.ts';
import type { BuildManifest, RenderedPage, SiteConfig } from '../types.ts';

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
 */
export async function writeSitemap(
	pages: RenderedPage[],
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

/**
 * Build and save the build manifest.
 */
export async function buildAndSaveManifest(
	pages: RenderedPage[],
	manifestPath: string,
	config: SiteConfig,
): Promise<BuildManifest> {
	const timestamp = Date.now();
	const manifest: BuildManifest = { version: 1, timestamp, pages: {} };

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
