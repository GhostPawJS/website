import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { isSiteError } from '../errors.ts';
import { readFile } from '../fs/read_file.ts';
import { writeFile } from '../fs/write_file.ts';
import { withTmpDir } from '../test_utils.ts';
import type { BuildManifest, SiteConfig } from '../types.ts';
import { build } from './build.ts';
import { cleanDist } from './clean.ts';
import { discoverFiles } from './discover.ts';
import { writeSitemap } from './finalize.ts';
import { scaffold } from './scaffold.ts';

const mockConfig: SiteConfig = { name: 'Test', url: 'https://test.com', language: 'en' };

// ---------------------------------------------------------------------------
// scaffold
// ---------------------------------------------------------------------------

describe('scaffold', () => {
	it('creates all expected project files', async () => {
		await withTmpDir(async (dir) => {
			await scaffold(dir, { name: 'My Site', url: 'https://mysite.com' });

			const required = [
				'site.json',
				'DOMAIN.md',
				'PERSONA.md',
				'templates/base.html',
				'templates/page.html',
				'templates/post.html',
				'templates/nav.html',
				'templates/footer.html',
				'assets/css/style.css',
				'assets/robots.txt',
				'assets/favicon.svg',
				'data/nav.json',
				'content/index.md',
				'content/about.md',
			];

			for (const rel of required) {
				const s = await stat(join(dir, rel));
				assert.ok(s.isFile(), `missing: ${rel}`);
			}
		});
	});

	it('site.json contains correct name and url', async () => {
		await withTmpDir(async (dir) => {
			await scaffold(dir, { name: 'Demo', url: 'https://demo.com' });
			const raw = await readFile(join(dir, 'site.json'));
			const cfg = JSON.parse(raw);
			assert.equal(cfg.name, 'Demo');
			assert.equal(cfg.url, 'https://demo.com');
		});
	});

	it('content/index.md contains site name', async () => {
		await withTmpDir(async (dir) => {
			await scaffold(dir, { name: 'Acme Corp' });
			const content = await readFile(join(dir, 'content', 'index.md'));
			assert.ok(content.includes('Acme Corp'));
		});
	});

	it('robots.txt references sitemap url', async () => {
		await withTmpDir(async (dir) => {
			await scaffold(dir, { url: 'https://site.com' });
			const robots = await readFile(join(dir, 'assets', 'robots.txt'));
			assert.ok(robots.includes('https://site.com/sitemap.xml'));
		});
	});
});

// ---------------------------------------------------------------------------
// discoverFiles
// ---------------------------------------------------------------------------

describe('discoverFiles', () => {
	it('discovers markdown content files', async () => {
		await withTmpDir(async (dir) => {
			await writeFile(join(dir, 'content', 'index.md'), '');
			await writeFile(join(dir, 'content', 'about.md'), '');
			const discovered = await discoverFiles(
				join(dir, 'content'),
				join(dir, 'templates'),
				join(dir, 'assets'),
				join(dir, 'data'),
			);
			assert.equal(discovered.contentFiles.length, 2);
		});
	});

	it('returns empty arrays for missing directories', async () => {
		await withTmpDir(async (dir) => {
			const discovered = await discoverFiles(
				join(dir, 'content'),
				join(dir, 'templates'),
				join(dir, 'assets'),
				join(dir, 'data'),
			);
			assert.deepEqual(discovered.contentFiles, []);
			assert.deepEqual(discovered.templateFiles, []);
		});
	});
});

// ---------------------------------------------------------------------------
// cleanDist
// ---------------------------------------------------------------------------

describe('cleanDist', () => {
	it('removes dist contents and recreates empty dir', async () => {
		await withTmpDir(async (dir) => {
			const dist = join(dir, 'dist');
			await writeFile(join(dist, 'index.html'), 'old');
			await cleanDist(dist);
			const s = await stat(dist);
			assert.ok(s.isDirectory());
			// old file should be gone
			await assert.rejects(
				() => readFile(join(dist, 'index.html')),
				(e: unknown) => isSiteError(e),
			);
		});
	});

	it('is a no-op when dist does not exist', async () => {
		await withTmpDir(async (dir) => {
			// Should not throw
			await cleanDist(join(dir, 'nonexistent-dist'));
		});
	});
});

// ---------------------------------------------------------------------------
// writeSitemap
// ---------------------------------------------------------------------------

describe('writeSitemap', () => {
	it('generates valid sitemap XML', async () => {
		await withTmpDir(async (dir) => {
			const pages = [
				{
					file: '/x.md',
					slug: '',
					url: '/',
					frontmatter: {},
					html: '',
					textContent: '',
					wordCount: 0,
				},
				{
					file: '/about.md',
					slug: 'about',
					url: '/about/',
					frontmatter: {},
					html: '',
					textContent: '',
					wordCount: 0,
				},
			];
			await writeSitemap(pages, dir, mockConfig);
			const xml = await readFile(join(dir, 'sitemap.xml'));
			assert.ok(xml.includes('<?xml'));
			assert.ok(xml.includes('<urlset'));
			assert.ok(xml.includes('https://test.com/'));
			assert.ok(xml.includes('https://test.com/about/'));
		});
	});

	it('excludes noindex pages', async () => {
		await withTmpDir(async (dir) => {
			const pages = [
				{
					file: '/x.md',
					slug: '',
					url: '/',
					frontmatter: {},
					html: '',
					textContent: '',
					wordCount: 0,
				},
				{
					file: '/secret.md',
					slug: 'secret',
					url: '/secret/',
					frontmatter: { noindex: true },
					html: '',
					textContent: '',
					wordCount: 0,
				},
			];
			await writeSitemap(pages, dir, mockConfig);
			const xml = await readFile(join(dir, 'sitemap.xml'));
			assert.ok(!xml.includes('/secret/'));
		});
	});
});

// ---------------------------------------------------------------------------
// build (E2E)
// ---------------------------------------------------------------------------

describe('build — end-to-end', () => {
	it('produces dist/ with index.html and sitemap.xml', async () => {
		await withTmpDir(async (dir) => {
			await scaffold(dir, { name: 'E2E Site', url: 'https://e2e.com' });
			const result = await build(dir);

			assert.ok(result.pages.length >= 2, 'at least 2 pages rendered');
			assert.equal(result.fitness, null);
			assert.ok(result.duration >= 0);

			// dist/index.html
			const indexHtml = await readFile(join(dir, 'dist', 'index.html'));
			assert.ok(
				indexHtml.includes('<!doctype html>') || indexHtml.includes('<!DOCTYPE html>'),
				'doctype present',
			);

			// dist/about/index.html
			const aboutHtml = await readFile(join(dir, 'dist', 'about', 'index.html'));
			assert.ok(aboutHtml.length > 0, 'about page rendered');

			// dist/sitemap.xml
			const sitemap = await readFile(join(dir, 'dist', 'sitemap.xml'));
			assert.ok(sitemap.includes('<urlset'));

			// dist/css/style.css (asset copy)
			const css = await readFile(join(dir, 'dist', 'css', 'style.css'));
			assert.ok(css.includes('font-family'));

			// .build-manifest.json
			const manifestRaw = await readFile(join(dir, '.build-manifest.json'));
			const manifest = JSON.parse(manifestRaw);
			assert.equal(manifest.version, 1);
			assert.ok(Object.keys(manifest.pages).length >= 2);
		});
	});

	it('rendered pages contain canonical URLs', async () => {
		await withTmpDir(async (dir) => {
			await scaffold(dir, { name: 'Canonical', url: 'https://canonical.com' });
			const result = await build(dir);
			const indexPage = result.pages.find((p) => p.url === '/');
			assert.ok(indexPage, 'homepage rendered');
			assert.ok(indexPage?.html.includes('https://canonical.com/'), 'canonical in head');
		});
	});

	it('rendered pages contain OG meta tags', async () => {
		await withTmpDir(async (dir) => {
			await scaffold(dir, { name: 'OG Test', url: 'https://og.com' });
			const result = await build(dir);
			const indexPage = result.pages.find((p) => p.url === '/');
			assert.ok(indexPage?.html.includes('og:title'), 'og:title present');
		});
	});

	it('sitemap references all indexable pages', async () => {
		await withTmpDir(async (dir) => {
			await scaffold(dir, { name: 'S', url: 'https://s.com' });
			await build(dir);
			const sitemap = await readFile(join(dir, 'dist', 'sitemap.xml'));
			// scaffold creates index + about
			assert.ok(sitemap.includes('https://s.com/'));
			assert.ok(sitemap.includes('https://s.com/about/'));
		});
	});

	it('build result has wordCount > 0 for content pages', async () => {
		await withTmpDir(async (dir) => {
			await scaffold(dir, { name: 'Words', url: 'https://w.com' });
			const result = await build(dir);
			const hasWords = result.pages.some((p) => p.wordCount > 0);
			assert.ok(hasWords, 'at least one page has words');
		});
	});

	it('throws not_found when site.json is missing', async () => {
		await withTmpDir(async (dir) => {
			// No scaffold — no site.json
			await assert.rejects(
				() => build(dir),
				(err: unknown) => isSiteError(err) && err.code === 'not_found',
			);
		});
	});

	it('build result includes skipped=0 for a full build', async () => {
		await withTmpDir(async (dir) => {
			await scaffold(dir, { name: 'Skip Test', url: 'https://skip.com' });
			const result = await build(dir);
			assert.equal(result.skipped, 0);
		});
	});
});

// ---------------------------------------------------------------------------
// build — incremental
// ---------------------------------------------------------------------------

describe('build — incremental', () => {
	it('no prior manifest → behaves like full build, writes manifest with fingerprint', async () => {
		await withTmpDir(async (dir) => {
			await scaffold(dir, { name: 'Inc', url: 'https://inc.com' });
			const result = await build(dir, { incremental: true });
			assert.ok(result.pages.length >= 2, 'pages rendered');
			assert.equal(result.skipped, 0, 'nothing to skip on first run');
			const raw = await readFile(join(dir, '.build-manifest.json'));
			const manifest: BuildManifest = JSON.parse(raw);
			assert.ok(manifest.sourceFingerprint.length > 0, 'fingerprint stored');
		});
	});

	it('second build with no changes skips all pages', async () => {
		await withTmpDir(async (dir) => {
			await scaffold(dir, { name: 'Inc2', url: 'https://inc2.com' });
			const first = await build(dir, { incremental: true });
			const second = await build(dir, { incremental: true });
			assert.equal(second.pages.length, 0, 'no pages re-rendered');
			assert.equal(second.skipped, first.pages.length, 'all pages skipped');
		});
	});

	it('re-renders only changed content files', async () => {
		await withTmpDir(async (dir) => {
			await scaffold(dir, { name: 'Inc3', url: 'https://inc3.com' });
			await build(dir, { incremental: true });

			// Modify one content file — bump its mtime
			const aboutPath = join(dir, 'content', 'about.md');
			const original = await readFile(aboutPath);
			await writeFile(aboutPath, `${original}\n\nExtra paragraph added.`);

			const second = await build(dir, { incremental: true });
			assert.equal(second.pages.length, 1, 'only about re-rendered');
			assert.equal(second.pages[0]?.url, '/about/', 'correct page re-rendered');
			assert.ok(second.skipped > 0, 'other pages skipped');
		});
	});

	it('full rebuild when a template changes', async () => {
		await withTmpDir(async (dir) => {
			await scaffold(dir, { name: 'Inc4', url: 'https://inc4.com' });
			const first = await build(dir, { incremental: true });

			// Touch a template file
			const basePath = join(dir, 'templates', 'base.html');
			const src = await readFile(basePath);
			await writeFile(basePath, `${src}<!-- touched -->`);

			const second = await build(dir, { incremental: true });
			assert.equal(second.skipped, 0, 'no pages skipped — full rebuild');
			assert.equal(second.pages.length, first.pages.length, 'all pages re-rendered');
		});
	});

	it('full rebuild when a data file changes', async () => {
		await withTmpDir(async (dir) => {
			await scaffold(dir, { name: 'Inc5', url: 'https://inc5.com' });
			const first = await build(dir, { incremental: true });

			// Modify the nav data file
			const navPath = join(dir, 'data', 'nav.json');
			const nav = JSON.parse(await readFile(navPath)) as unknown[];
			await writeFile(navPath, JSON.stringify([...nav, { label: 'Extra', href: '/extra/' }]));

			const second = await build(dir, { incremental: true });
			assert.equal(second.skipped, 0, 'full rebuild triggered by data change');
			assert.equal(second.pages.length, first.pages.length, 'all pages re-rendered');
		});
	});

	it('removes stale dist page when source is deleted', async () => {
		await withTmpDir(async (dir) => {
			await scaffold(dir, { name: 'Inc6', url: 'https://inc6.com' });
			// Add an extra page
			await writeFile(
				join(dir, 'content', 'extra.md'),
				'---\ntitle: Extra\nlayout: page.html\n---\n\nContent.',
			);
			await build(dir, { incremental: true });
			// Verify extra page was built
			const extraBefore = await readFile(join(dir, 'dist', 'extra', 'index.html'));
			assert.ok(extraBefore.length > 0, 'extra page built');

			// Delete source, rebuild incrementally — stale dist file should go
			const { rm } = await import('node:fs/promises');
			await rm(join(dir, 'content', 'extra.md'));
			await build(dir, { incremental: true });

			await assert.rejects(
				() => readFile(join(dir, 'dist', 'extra', 'index.html')),
				(e: unknown) => isSiteError(e),
				'stale dist file removed',
			);
		});
	});

	it('non-incremental build always renders all pages', async () => {
		await withTmpDir(async (dir) => {
			await scaffold(dir, { name: 'NonInc', url: 'https://noninc.com' });
			await build(dir); // first build
			const second = await build(dir); // no incremental flag
			assert.equal(second.skipped, 0, 'all pages rendered in full mode');
			assert.ok(second.pages.length >= 2);
		});
	});
});
