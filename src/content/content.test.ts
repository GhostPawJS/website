import assert from 'node:assert/strict';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { isSiteError } from '../errors.ts';
import { writeFile } from '../fs/write_file.ts';
import { withTmpDir } from '../test_utils.ts';
import { buildCollectionsContext, groupByCollection } from './collections.ts';
import { buildPageIndex } from './page_index.ts';
import { parsePage, parsePageSource } from './parse_page.ts';
import {
	absoluteUrl,
	fileToSlug,
	sanitizeSlug,
	slugToCollection,
	slugToUrl,
	urlToOutputFile,
} from './url_routing.ts';

// ---------------------------------------------------------------------------
// url_routing
// ---------------------------------------------------------------------------

describe('fileToSlug', () => {
	it('index.md → empty string', () => assert.equal(fileToSlug('index.md'), ''));
	it('about.md → "about"', () => assert.equal(fileToSlug('about.md'), 'about'));
	it('blog/_index.md → "blog"', () => assert.equal(fileToSlug('blog/_index.md'), 'blog'));
	it('blog/first-post.md → "blog/first-post"', () =>
		assert.equal(fileToSlug('blog/first-post.md'), 'blog/first-post'));
	it('docs/api/fetch.md → "docs/api/fetch"', () =>
		assert.equal(fileToSlug('docs/api/fetch.md'), 'docs/api/fetch'));
	it('normalizes underscores to hyphens in filename', () =>
		assert.equal(fileToSlug('my_page.md'), 'my-page'));
	it('normalizes underscores in directory segments', () =>
		assert.equal(fileToSlug('case_studies/my_post.md'), 'case-studies/my-post'));
	it('preserves _index pattern (stripped before normalization)', () =>
		assert.equal(fileToSlug('blog/_index.md'), 'blog'));
});

describe('slugToUrl', () => {
	it('empty string → "/"', () => assert.equal(slugToUrl(''), '/'));
	it('"index" → "/"', () => assert.equal(slugToUrl('index'), '/'));
	it('"about" → "/about/"', () => assert.equal(slugToUrl('about'), '/about/'));
	it('"blog/first-post" → "/blog/first-post/"', () =>
		assert.equal(slugToUrl('blog/first-post'), '/blog/first-post/'));
});

describe('slugToCollection', () => {
	it('empty slug → null', () => assert.equal(slugToCollection(''), null));
	it('root page → null', () => assert.equal(slugToCollection('about'), null));
	it('nested page → first segment', () => assert.equal(slugToCollection('blog/post'), 'blog'));
	it('deep nested → first segment', () => assert.equal(slugToCollection('docs/api/fetch'), 'docs'));
});

describe('sanitizeSlug', () => {
	it('lowercases', () => assert.equal(sanitizeSlug('About'), 'about'));
	it('replaces spaces with hyphens', () =>
		assert.equal(sanitizeSlug('hello world'), 'hello-world'));
	it('replaces underscores with hyphens', () =>
		assert.equal(sanitizeSlug('hello_world'), 'hello-world'));
	it('collapses double hyphens', () => assert.equal(sanitizeSlug('foo--bar'), 'foo-bar'));
	it('collapses mixed space+underscore runs', () =>
		assert.equal(sanitizeSlug('foo _ bar'), 'foo-bar'));
	it('strips special characters', () => assert.equal(sanitizeSlug('foo@bar!'), 'foobar'));
});

describe('absoluteUrl', () => {
	it('combines base and path', () =>
		assert.equal(absoluteUrl('https://example.com', '/about/'), 'https://example.com/about/'));
	it('strips trailing slash from base', () =>
		assert.equal(absoluteUrl('https://example.com/', '/about/'), 'https://example.com/about/'));
	it('adds leading slash if missing', () =>
		assert.equal(absoluteUrl('https://example.com', 'about/'), 'https://example.com/about/'));
});

describe('urlToOutputFile', () => {
	it('"/" → "index.html"', () => assert.equal(urlToOutputFile('/'), 'index.html'));
	it('"/about/" → "about/index.html"', () =>
		assert.equal(urlToOutputFile('/about/'), 'about/index.html'));
	it('"/blog/post/" → "blog/post/index.html"', () =>
		assert.equal(urlToOutputFile('/blog/post/'), 'blog/post/index.html'));
});

// ---------------------------------------------------------------------------
// parsePageSource
// ---------------------------------------------------------------------------

describe('parsePageSource', () => {
	it('parses frontmatter and body', () => {
		const src = '---\ntitle: Hello\n---\n# Hello\n';
		const page = parsePageSource(src, '/content/about.md', 'about.md');
		assert.equal(page.frontmatter.title, 'Hello');
		assert.equal(page.body.trim(), '# Hello');
		assert.equal(page.url, '/about/');
		assert.equal(page.collection, null);
	});

	it('handles file with no frontmatter', () => {
		const page = parsePageSource('# No frontmatter', '/content/index.md', 'index.md');
		assert.equal(page.url, '/');
		assert.deepEqual(page.frontmatter, {});
	});

	it('detects collection from path', () => {
		const page = parsePageSource(
			'---\ntitle: Post\n---\nbody',
			'/content/blog/post.md',
			'blog/post.md',
		);
		assert.equal(page.collection, 'blog');
		assert.equal(page.url, '/blog/post/');
	});

	it('throws validation on bad frontmatter', () => {
		// Malformed YAML in frontmatter
		assert.throws(
			() => parsePageSource('---\n: broken: yaml:\n---\nbody', '/x.md', 'x.md'),
			(err: unknown) => isSiteError(err) && err.code === 'validation',
		);
	});
});

describe('parsePage', () => {
	it('reads file from disk and parses it', async () => {
		await withTmpDir(async (dir) => {
			const p = join(dir, 'about.md');
			await writeFile(p, '---\ntitle: About\n---\ncontent here');
			const page = await parsePage(p, 'about.md');
			assert.equal(page.frontmatter.title, 'About');
			assert.equal(page.url, '/about/');
		});
	});
});

// ---------------------------------------------------------------------------
// buildPageIndex
// ---------------------------------------------------------------------------

describe('buildPageIndex', () => {
	it('discovers all .md files and parses them', async () => {
		await withTmpDir(async (dir) => {
			await writeFile(join(dir, 'index.md'), '---\ntitle: Home\n---\n');
			await writeFile(join(dir, 'about.md'), '---\ntitle: About\n---\n');
			await writeFile(join(dir, 'blog', '_index.md'), '---\ntitle: Blog\n---\n');
			await writeFile(join(dir, 'blog', 'post.md'), '---\ntitle: Post\n---\n');

			const pages = await buildPageIndex(dir);
			const urls = pages.map((p) => p.url).sort();
			assert.deepEqual(urls, ['/', '/about/', '/blog/', '/blog/post/']);
		});
	});

	it('ignores non-.md files', async () => {
		await withTmpDir(async (dir) => {
			await writeFile(join(dir, 'index.md'), '---\ntitle: Home\n---\n');
			await writeFile(join(dir, 'readme.txt'), 'ignore me');
			const pages = await buildPageIndex(dir);
			assert.equal(pages.length, 1);
		});
	});

	it('returns empty array for empty directory', async () => {
		await withTmpDir(async (dir) => {
			const pages = await buildPageIndex(dir);
			assert.deepEqual(pages, []);
		});
	});
});

// ---------------------------------------------------------------------------
// groupByCollection / buildCollectionsContext
// ---------------------------------------------------------------------------

describe('groupByCollection', () => {
	it('puts root pages under empty key', () => {
		const pages = [
			parsePageSource('', '/index.md', 'index.md'),
			parsePageSource('', '/about.md', 'about.md'),
		];
		const map = groupByCollection(pages);
		assert.ok(map.has(''));
		const rootCol = map.get('');
		assert.ok(rootCol);
		assert.equal(rootCol.pages.length + (rootCol.index ? 1 : 0), 2);
	});

	it('identifies collection index page', () => {
		const idx = parsePageSource('', '/blog/_index.md', 'blog/_index.md');
		const post = parsePageSource('', '/blog/post.md', 'blog/post.md');
		const map = groupByCollection([idx, post]);
		const col = map.get('blog');
		assert.ok(col);
		assert.equal(col.index?.slug, 'blog');
		assert.equal(col.pages.length, 1);
	});
});

describe('buildCollectionsContext', () => {
	it('returns collection arrays indexed by name', () => {
		const post1 = parsePageSource('---\ntitle: P1\n---\n', '/blog/p1.md', 'blog/p1.md');
		const post2 = parsePageSource('---\ntitle: P2\n---\n', '/blog/p2.md', 'blog/p2.md');
		const ctx = buildCollectionsContext([post1, post2]);
		assert.ok(Array.isArray(ctx.blog));
		assert.equal((ctx.blog as unknown[]).length, 2);
	});

	it('excludes root collection from context', () => {
		const home = parsePageSource('', '/index.md', 'index.md');
		const ctx = buildCollectionsContext([home]);
		assert.ok(!Object.hasOwn(ctx, ''));
	});

	it('surfaces og_image: in collection context', () => {
		const post = parsePageSource(
			'---\ntitle: Post\nog_image: /img/hero.jpg\n---\n',
			'/blog/post.md',
			'blog/post.md',
		);
		const ctx = buildCollectionsContext([post]);
		const items = ctx.blog as Array<Record<string, unknown>>;
		assert.equal(items[0]?.og_image, '/img/hero.jpg');
	});

	it('surfaces image: alias as og_image in collection context', () => {
		const post = parsePageSource(
			'---\ntitle: Post\nimage: /img/hero.jpg\n---\n',
			'/blog/post.md',
			'blog/post.md',
		);
		const ctx = buildCollectionsContext([post]);
		const items = ctx.blog as Array<Record<string, unknown>>;
		assert.equal(items[0]?.og_image, '/img/hero.jpg');
	});

	it('og_image: takes precedence over image: in collection context', () => {
		const post = parsePageSource(
			'---\ntitle: Post\nog_image: /primary.jpg\nimage: /secondary.jpg\n---\n',
			'/blog/post.md',
			'blog/post.md',
		);
		const ctx = buildCollectionsContext([post]);
		const items = ctx.blog as Array<Record<string, unknown>>;
		assert.equal(items[0]?.og_image, '/primary.jpg');
	});

	it('sorts posts newest-first by datePublished', () => {
		const old = parsePageSource(
			'---\ntitle: Old Post\ndatePublished: 2023-01-01\n---\n',
			'/blog/old.md',
			'blog/old.md',
		);
		const middle = parsePageSource(
			'---\ntitle: Middle Post\ndatePublished: 2024-06-15\n---\n',
			'/blog/middle.md',
			'blog/middle.md',
		);
		const newest = parsePageSource(
			'---\ntitle: New Post\ndatePublished: 2025-03-20\n---\n',
			'/blog/new.md',
			'blog/new.md',
		);
		// Pass in ascending order — output must be reversed
		const ctx = buildCollectionsContext([old, middle, newest]);
		const items = ctx.blog as Array<Record<string, unknown>>;
		assert.equal(items[0]?.title, 'New Post');
		assert.equal(items[1]?.title, 'Middle Post');
		assert.equal(items[2]?.title, 'Old Post');
	});

	it('sorts by date when datePublished is absent', () => {
		const a = parsePageSource('---\ntitle: A\ndate: 2022-01-01\n---\n', '/blog/a.md', 'blog/a.md');
		const b = parsePageSource('---\ntitle: B\ndate: 2024-01-01\n---\n', '/blog/b.md', 'blog/b.md');
		const ctx = buildCollectionsContext([a, b]);
		const items = ctx.blog as Array<Record<string, unknown>>;
		assert.equal(items[0]?.title, 'B');
	});

	it('datePublished takes precedence over date for sort', () => {
		// date is newer but datePublished is older → datePublished wins
		const a = parsePageSource(
			'---\ntitle: A\ndate: 2025-01-01\ndatePublished: 2021-01-01\n---\n',
			'/blog/a.md',
			'blog/a.md',
		);
		const b = parsePageSource(
			'---\ntitle: B\ndate: 2020-01-01\ndatePublished: 2024-01-01\n---\n',
			'/blog/b.md',
			'blog/b.md',
		);
		const ctx = buildCollectionsContext([a, b]);
		const items = ctx.blog as Array<Record<string, unknown>>;
		// B has newer datePublished → comes first
		assert.equal(items[0]?.title, 'B');
	});
});
