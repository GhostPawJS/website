import assert from 'node:assert/strict';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { BASE_HTML } from '../build/scaffold_templates.ts';
import { parsePageSource } from '../content/parse_page.ts';
import { writeFile } from '../fs/write_file.ts';
import { withTmpDir } from '../test_utils.ts';
import type { SiteConfig } from '../types.ts';
import { buildHeadInjection, injectHead } from './auto_inject.ts';
import { countWords, renderMarkdown, stripHtml } from './markdown.ts';
import { loadTemplates, renderPage } from './render_page.ts';
import { buildTemplateContext, loadDataFiles } from './template_context.ts';

const mockConfig: SiteConfig = {
	name: 'Test Site',
	url: 'https://example.com',
	language: 'en',
};

// ---------------------------------------------------------------------------
// renderMarkdown / stripHtml / countWords
// ---------------------------------------------------------------------------

describe('renderMarkdown', () => {
	it('converts heading', () => {
		const html = renderMarkdown('# Hello');
		assert.ok(html.includes('<h1>Hello</h1>'));
	});

	it('converts paragraph', () => {
		const html = renderMarkdown('Hello world');
		assert.ok(html.includes('<p>Hello world</p>'));
	});

	it('converts bold', () => {
		const html = renderMarkdown('**bold**');
		assert.ok(html.includes('<strong>bold</strong>'));
	});
});

describe('stripHtml', () => {
	it('strips tags', () => {
		assert.equal(stripHtml('<p>Hello <b>world</b></p>'), 'Hello world');
	});

	it('strips script tags and content', () => {
		const text = stripHtml('<p>ok</p><script>alert(1)</script>');
		assert.ok(!text.includes('alert'));
	});

	it('decodes common entities', () => {
		assert.equal(stripHtml('&amp;&lt;&gt;'), '&<>');
	});
});

describe('countWords', () => {
	it('counts words separated by whitespace', () => {
		assert.equal(countWords('hello world foo'), 3);
	});

	it('returns 0 for empty string', () => {
		assert.equal(countWords(''), 0);
	});

	it('handles extra whitespace', () => {
		assert.equal(countWords('  hello   world  '), 2);
	});
});

// ---------------------------------------------------------------------------
// loadDataFiles
// ---------------------------------------------------------------------------

describe('loadDataFiles', () => {
	it('loads JSON files from data dir', async () => {
		await withTmpDir(async (dir) => {
			await writeFile(join(dir, 'nav.json'), JSON.stringify([{ label: 'Home', href: '/' }]));
			const data = await loadDataFiles(dir);
			assert.ok(Array.isArray(data.nav));
		});
	});

	it('returns empty object for missing directory', async () => {
		await withTmpDir(async (dir) => {
			const data = await loadDataFiles(join(dir, 'nonexistent'));
			assert.deepEqual(data, {});
		});
	});

	it('skips malformed JSON', async () => {
		await withTmpDir(async (dir) => {
			await writeFile(join(dir, 'bad.json'), '{ broken }');
			await writeFile(join(dir, 'good.json'), '{"ok":true}');
			const data = await loadDataFiles(dir);
			assert.ok(!Object.hasOwn(data, 'bad'));
			assert.deepEqual(data.good, { ok: true });
		});
	});
});

// ---------------------------------------------------------------------------
// buildTemplateContext
// ---------------------------------------------------------------------------

describe('buildTemplateContext', () => {
	it('includes page, site, data, collections, build', () => {
		const page = parsePageSource('---\ntitle: Hello\n---\n', '/p.md', 'index.md');
		const ctx = buildTemplateContext(page, mockConfig, [page], {}, 1000);
		assert.equal((ctx.page as { title: string }).title, 'Hello');
		assert.equal((ctx.site as { name: string }).name, 'Test Site');
		assert.ok(typeof ctx.build === 'object');
	});

	it('page.url is derived correctly', () => {
		const page = parsePageSource('', '/about.md', 'about.md');
		const ctx = buildTemplateContext(page, mockConfig, [page], {}, 0);
		assert.equal((ctx.page as { url: string }).url, '/about/');
	});
});

// ---------------------------------------------------------------------------
// buildHeadInjection / injectHead
// ---------------------------------------------------------------------------

describe('buildHeadInjection', () => {
	it('includes charset', () => {
		const page = parsePageSource('---\ntitle: T\ndescription: D\n---\n', '/p.md', 'index.md');
		const head = buildHeadInjection(page, mockConfig);
		assert.ok(head.includes('UTF-8'));
	});

	it('includes canonical url', () => {
		const page = parsePageSource('---\ntitle: About\n---\n', '/about.md', 'about.md');
		const head = buildHeadInjection(page, mockConfig);
		assert.ok(head.includes('https://example.com/about/'));
	});

	it('includes og:title', () => {
		const page = parsePageSource('---\ntitle: My Page\n---\n', '/p.md', 'index.md');
		const head = buildHeadInjection(page, mockConfig);
		assert.ok(head.includes('og:title'));
	});

	it('adds noindex/nofollow robots directive', () => {
		const page = parsePageSource(
			'---\ntitle: T\nnoindex: true\nnofollow: true\n---\n',
			'/p.md',
			'p.md',
		);
		const head = buildHeadInjection(page, mockConfig);
		assert.ok(head.includes('noindex'));
		assert.ok(head.includes('nofollow'));
	});

	it('adds Article JSON-LD for schema_type Article', () => {
		const page = parsePageSource(
			'---\ntitle: T\nschema_type: Article\ndate: 2024-01-01\n---\n',
			'/p.md',
			'p.md',
		);
		const head = buildHeadInjection(page, mockConfig);
		assert.ok(head.includes('application/ld+json'));
		assert.ok(head.includes('BlogPosting') || head.includes('Article'));
	});

	it('injects FAQPage JSON-LD when page.faqs is present', () => {
		const page = parsePageSource(
			'---\ntitle: FAQ\nfaqs:\n  - q: "What is this?"\n    a: "It is a test."\n  - q: "Why?"\n    a: "Because."\n---\n',
			'/faq.md',
			'faq.md',
		);
		const head = buildHeadInjection(page, mockConfig);
		assert.ok(head.includes('FAQPage'));
		assert.ok(head.includes('What is this?'));
		assert.ok(head.includes('It is a test.'));
		// Valid JSON
		const jsonMatch = head.match(/<script[^>]+ld\+json[^>]*>([\s\S]*?)<\/script>/);
		assert.ok(jsonMatch, 'Expected JSON-LD script tag');
		assert.doesNotThrow(() => JSON.parse(jsonMatch?.[1] ?? ''), 'JSON-LD must be valid JSON');
	});

	it('does not inject FAQPage JSON-LD when faqs is absent', () => {
		const page = parsePageSource('---\ntitle: Normal\n---\n', '/normal.md', 'normal.md');
		const head = buildHeadInjection(page, mockConfig);
		assert.ok(!head.includes('FAQPage'));
	});

	it('does not inject FAQPage JSON-LD when faqs is an empty array', () => {
		const page = parsePageSource('---\ntitle: Empty\nfaqs: []\n---\n', '/empty.md', 'empty.md');
		const head = buildHeadInjection(page, mockConfig);
		assert.ok(!head.includes('FAQPage'));
	});

	it('injects BreadcrumbList JSON-LD when page.breadcrumb is present', () => {
		const page = parsePageSource(
			'---\ntitle: Post\nbreadcrumb:\n  - label: Home\n    href: /\n  - label: Blog\n    href: /blog/\n  - label: Post\n    href: /blog/post/\n---\n',
			'/blog/post.md',
			'blog/post.md',
		);
		const head = buildHeadInjection(page, mockConfig);
		assert.ok(head.includes('BreadcrumbList'));
		assert.ok(head.includes('"position": 1'));
		assert.ok(head.includes('"position": 3'));
		assert.ok(head.includes('Home'));
		// Valid JSON
		const scripts = [...head.matchAll(/<script[^>]+ld\+json[^>]*>([\s\S]*?)<\/script>/g)];
		const breadcrumbScript = scripts.find((m) => (m[1] ?? '').includes('BreadcrumbList'));
		assert.ok(breadcrumbScript, 'Expected BreadcrumbList script tag');
		assert.doesNotThrow(
			() => JSON.parse(breadcrumbScript[1] ?? ''),
			'BreadcrumbList JSON-LD must be valid JSON',
		);
	});

	it('does not inject BreadcrumbList when breadcrumb is absent', () => {
		const page = parsePageSource('---\ntitle: Normal\n---\n', '/normal.md', 'normal.md');
		const head = buildHeadInjection(page, mockConfig);
		assert.ok(!head.includes('BreadcrumbList'));
	});

	it('includes absolute URLs in BreadcrumbList items', () => {
		const page = parsePageSource(
			'---\ntitle: Post\nbreadcrumb:\n  - label: Home\n    href: /\n---\n',
			'/p.md',
			'p.md',
		);
		const head = buildHeadInjection(page, mockConfig);
		assert.ok(head.includes('https://example.com'));
	});

	it('injects og:image from og_image: field', () => {
		const page = parsePageSource(
			'---\ntitle: T\nog_image: /images/hero.jpg\n---\n',
			'/p.md',
			'p.md',
		);
		const head = buildHeadInjection(page, mockConfig);
		assert.ok(head.includes('og:image'), 'Expected og:image meta tag');
		assert.ok(head.includes('/images/hero.jpg'), 'Expected image path in tag');
	});

	it('injects og:image from image: field (alias)', () => {
		const page = parsePageSource('---\ntitle: T\nimage: /images/hero.jpg\n---\n', '/p.md', 'p.md');
		const head = buildHeadInjection(page, mockConfig);
		assert.ok(head.includes('og:image'), 'image: alias should produce og:image tag');
		assert.ok(head.includes('/images/hero.jpg'));
	});

	it('og_image: takes precedence over image: when both present', () => {
		const page = parsePageSource(
			'---\ntitle: T\nog_image: /primary.jpg\nimage: /secondary.jpg\n---\n',
			'/p.md',
			'p.md',
		);
		const head = buildHeadInjection(page, mockConfig);
		assert.ok(head.includes('/primary.jpg'));
		assert.ok(!head.includes('/secondary.jpg'));
	});

	// ── post layout: og:type, article metas, BlogPosting JSON-LD ──────────────

	it('post page emits og:type article', () => {
		const page = parsePageSource('---\ntitle: My Post\nlayout: post.html\n---\n', '/b.md', 'b.md');
		const head = buildHeadInjection(page, mockConfig);
		assert.ok(head.includes('og:type" content="article"'), 'post page must use og:type article');
	});

	it('non-post page emits og:type website', () => {
		const page = parsePageSource('---\ntitle: About\nlayout: page.html\n---\n', '/a.md', 'a.md');
		const head = buildHeadInjection(page, mockConfig);
		assert.ok(
			head.includes('og:type" content="website"'),
			'non-post page must use og:type website',
		);
	});

	it('post page emits article:published_time when datePublished is set', () => {
		const page = parsePageSource(
			'---\ntitle: Post\nlayout: post.html\ndatePublished: "2024-03-15"\n---\n',
			'/b.md',
			'b.md',
		);
		const head = buildHeadInjection(page, mockConfig);
		assert.ok(head.includes('article:published_time'), 'must emit article:published_time');
		assert.ok(head.includes('2024-03-15'), 'must include datePublished value');
	});

	it('post page with no datePublished does not emit article:published_time', () => {
		const page = parsePageSource('---\ntitle: Post\nlayout: post.html\n---\n', '/b.md', 'b.md');
		const head = buildHeadInjection(page, mockConfig);
		assert.ok(!head.includes('article:published_time'), 'must not emit when datePublished absent');
	});

	it('post page emits BlogPosting JSON-LD with correct fields', () => {
		const page = parsePageSource(
			'---\ntitle: Solar Post\ndescription: A solar article.\nlayout: post.html\ndatePublished: "2024-03-15"\nauthor: Jana Kovač\nog_image: /images/post.jpg\n---\n',
			'/b/solar-post.md',
			'b/solar-post.md',
		);
		const head = buildHeadInjection(page, mockConfig);
		assert.ok(head.includes('BlogPosting'), 'must include BlogPosting type');
		assert.ok(head.includes('Solar Post'), 'must include headline');
		assert.ok(head.includes('2024-03-15'), 'must include datePublished');
		assert.ok(head.includes('Jana Kova'), 'must include author name');
		assert.ok(head.includes('/images/post.jpg'), 'must include image');
		const scripts = [...head.matchAll(/<script[^>]+ld\+json[^>]*>([\s\S]*?)<\/script>/g)];
		const blogScript = scripts.find((m) => (m[1] ?? '').includes('BlogPosting'));
		assert.ok(blogScript, 'expected BlogPosting script tag');
		const parsed = JSON.parse(blogScript[1] ?? '{}') as Record<string, unknown>;
		assert.equal(parsed['@type'], 'BlogPosting');
		const author = parsed.author as Record<string, unknown>;
		assert.equal(author['@type'], 'Person');
		assert.ok(String(author.name).includes('Jana Kova'));
	});

	// ── twitter:card downgrade ─────────────────────────────────────────────────

	it('page with no og:image uses twitter:card summary', () => {
		const page = parsePageSource('---\ntitle: No Image\n---\n', '/p.md', 'p.md');
		const head = buildHeadInjection(page, mockConfig);
		assert.ok(head.includes('twitter:card" content="summary"'), 'must use summary without image');
		assert.ok(!head.includes('summary_large_image'), 'must not use summary_large_image');
	});

	it('page with og:image uses twitter:card summary_large_image', () => {
		const page = parsePageSource('---\ntitle: T\nog_image: /hero.jpg\n---\n', '/p.md', 'p.md');
		const head = buildHeadInjection(page, mockConfig);
		assert.ok(head.includes('summary_large_image'), 'must use summary_large_image with image');
	});

	// ── Organization JSON-LD on homepage ──────────────────────────────────────

	it('homepage emits Organization JSON-LD', () => {
		const page = parsePageSource('---\ntitle: Home\n---\n', '/index.md', 'index.md');
		const head = buildHeadInjection(page, mockConfig);
		assert.ok(head.includes('"Organization"'), 'homepage must emit Organization JSON-LD');
		const scripts = [...head.matchAll(/<script[^>]+ld\+json[^>]*>([\s\S]*?)<\/script>/g)];
		const orgScript = scripts.find((m) => (m[1] ?? '').includes('Organization'));
		assert.ok(orgScript, 'expected Organization script tag');
		assert.doesNotThrow(() => JSON.parse(orgScript[1] ?? ''), 'Organization JSON-LD must be valid');
		assert.ok(head.includes('"WebSite"'), 'homepage must also emit WebSite JSON-LD');
	});

	it('non-homepage does not emit Organization JSON-LD', () => {
		const page = parsePageSource('---\ntitle: About\n---\n', '/about.md', 'about.md');
		const head = buildHeadInjection(page, mockConfig);
		assert.ok(!head.includes('"Organization"'), 'non-homepage must not emit Organization JSON-LD');
	});
});

describe('BASE_HTML scaffold template', () => {
	it('does not contain the auto-inject placeholder comment', () => {
		assert.ok(
			!BASE_HTML.includes('auto-injected meta tags will appear here'),
			'BASE_HTML must not contain the placeholder comment',
		);
	});
});

describe('injectHead', () => {
	it('inserts before </head>', () => {
		const doc = '<html><head><title>T</title></head><body></body></html>';
		const result = injectHead(doc, '<meta name="x">');
		assert.ok(
			result.includes('<meta name="x"></head>') || result.includes('<meta name="x">\n</head>'),
		);
	});

	it('returns document unchanged when no </head>', () => {
		const doc = '<p>no head</p>';
		assert.equal(injectHead(doc, '<meta>'), doc);
	});
});

// ---------------------------------------------------------------------------
// renderPage (integration)
// ---------------------------------------------------------------------------

describe('renderPage', () => {
	it('renders page without layout (bare markdown)', async () => {
		const page = parsePageSource(
			'---\ntitle: Hello\n---\n# Hello\n\nWorld.',
			'/index.md',
			'index.md',
		);
		const rendered = await renderPage(page, mockConfig, [page], new Map(), {}, Date.now());
		assert.ok(rendered.html.includes('<h1>'));
		assert.ok(rendered.wordCount > 0);
	});

	it('renders page with a single layout', async () => {
		const templates = new Map([
			['base.html', '<html><head></head><body>{{{ content }}}</body></html>'],
		]);
		const page = parsePageSource(
			'---\ntitle: Hi\nlayout: base.html\n---\nHello',
			'/index.md',
			'index.md',
		);
		const rendered = await renderPage(page, mockConfig, [page], templates, {}, Date.now());
		assert.ok(rendered.html.includes('<body>'));
		assert.ok(rendered.html.includes('Hello'));
	});

	it('renders nested layout chain', async () => {
		const templates = new Map([
			['base.html', '<html><head></head><body>{{{ content }}}</body></html>'],
			['page.html', '<!-- layout: base.html -->\n<main>{{{ content }}}</main>'],
		]);
		const page = parsePageSource(
			'---\ntitle: Page\nlayout: page.html\n---\nContent',
			'/p.md',
			'p.md',
		);
		const rendered = await renderPage(page, mockConfig, [page], templates, {}, Date.now());
		assert.ok(rendered.html.includes('<main>'));
		assert.ok(rendered.html.includes('<body>'));
		assert.ok(rendered.html.includes('Content'));
	});

	it('auto-injects canonical into <head>', async () => {
		const templates = new Map([
			['base.html', '<html><head></head><body>{{{ content }}}</body></html>'],
		]);
		const page = parsePageSource(
			'---\ntitle: About\nlayout: base.html\n---\ntext',
			'/about.md',
			'about.md',
		);
		const rendered = await renderPage(page, mockConfig, [page], templates, {}, Date.now());
		assert.ok(rendered.html.includes('canonical'));
		assert.ok(rendered.html.includes('https://example.com/about/'));
	});

	it('template: field works as alias for layout:', async () => {
		const templates = new Map([
			['base.html', '<html><head></head><body>{{{ content }}}</body></html>'],
		]);
		const page = parsePageSource(
			'---\ntitle: Hi\ntemplate: base.html\n---\nHello',
			'/index.md',
			'index.md',
		);
		const rendered = await renderPage(page, mockConfig, [page], templates, {}, Date.now());
		assert.ok(rendered.html.includes('<body>'), 'template: alias should resolve layout chain');
		assert.ok(rendered.html.includes('Hello'));
		assert.ok(rendered.html.includes('<title>'), 'head injection should apply');
	});

	it('loadTemplates reads html files from directory', async () => {
		await withTmpDir(async (dir) => {
			await writeFile(join(dir, 'base.html'), '<html>{{{ content }}}</html>');
			await writeFile(
				join(dir, 'page.html'),
				'<!-- layout: base.html -->\n<main>{{{ content }}}</main>',
			);
			const templates = await loadTemplates(dir);
			assert.ok(templates.has('base.html'));
			assert.ok(templates.has('page.html'));
		});
	});
});
