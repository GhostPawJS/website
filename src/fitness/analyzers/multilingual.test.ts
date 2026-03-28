import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { RenderedPage } from '../../types.ts';
import { getLanguageKit } from '../language.ts';
import type { TfidfIndex } from '../tfidf.ts';
import type { SiteContext } from '../types.ts';
import { multilingual } from './multilingual.ts';

function makeCtx(overrides: Partial<SiteContext> = {}): SiteContext {
	return {
		pages: [],
		pageSet: new Set(),
		config: { name: 'Test', url: 'https://example.com', language: 'en' },
		linkGraph: {
			outgoing: new Map(),
			incoming: new Map(),
			externalLinks: new Map(),
			anchorTexts: new Map(),
			depth: new Map(),
			orphans: [],
		},
		tfidf: { vectors: new Map(), descSimilarities: new Map() } as unknown as TfidfIndex,
		domain: '',
		persona: '',
		sitemapXml: '',
		robotsTxt: '',
		language: getLanguageKit('en'),
		paths: {
			root: '/tmp',
			dist: '/tmp/dist',
			siteJson: '/tmp/site.json',
			domainMd: '/tmp/DOMAIN.md',
			personaMd: '/tmp/PERSONA.md',
			assets: '/tmp/assets',
			templates: '/tmp/templates',
			content: '/tmp/content',
			data: '/tmp/data',
			buildManifest: '/tmp/.build-manifest.json',
			fitnessHistory: '/tmp/.fitness-history.json',
		},
		...overrides,
	};
}

function makePage(overrides: Partial<RenderedPage> = {}): RenderedPage {
	return {
		url: '/test/',
		file: '/tmp/content/test.md',
		slug: 'test',
		frontmatter: {},
		html: '<html><head><title>Test</title></head><body><h1>Test</h1><p>Content here.</p></body></html>',
		textContent: 'Test Content here.',
		wordCount: 10,
		...overrides,
	};
}

describe('multilingual analyzer', () => {
	// applies() gating
	it('does not apply when no hreflang tags and no languages config', () => {
		const page = makePage();
		const ctx = makeCtx({ pages: [page], pageSet: new Set([page.url]) });
		assert.ok(!multilingual.applies(ctx));
	});

	it('does not apply when no pages', () => {
		assert.ok(!multilingual.applies(makeCtx()));
	});

	it('applies when a page has hreflang link tags', () => {
		const html =
			'<html><head><link rel="alternate" hreflang="en" href="https://example.com/test/"></head><body></body></html>';
		const page = makePage({ html });
		const ctx = makeCtx({ pages: [page], pageSet: new Set([page.url]) });
		assert.ok(multilingual.applies(ctx));
	});

	it('applies when config.languages has more than one entry', () => {
		const ctx = makeCtx({
			pages: [makePage()],
			pageSet: new Set(['/test/']),
			config: { name: 'Test', url: 'https://example.com', language: 'en', languages: ['en', 'de'] },
		});
		assert.ok(multilingual.applies(ctx));
	});

	it('does not apply when config.languages has only one entry', () => {
		const ctx = makeCtx({
			pages: [makePage()],
			pageSet: new Set(['/test/']),
			config: { name: 'Test', url: 'https://example.com', language: 'en', languages: ['en'] },
		});
		assert.ok(!multilingual.applies(ctx));
	});

	// hreflang_relative
	it('flags relative hreflang href', () => {
		const html =
			'<html><head><link rel="alternate" hreflang="de" href="/de/test/"></head><body></body></html>';
		const page = makePage({ html });
		const ctx = makeCtx({ pages: [page], pageSet: new Set([page.url]) });
		const results = multilingual.analyze(ctx);
		const fails = results.filter((r) => !r.pass) as { pass: false; issue: { code: string } }[];
		assert.ok(fails.some((r) => r.issue.code === 'hreflang_relative'));
	});

	it('passes absolute hreflang href', () => {
		const html =
			'<html><head><link rel="alternate" hreflang="de" href="https://de.example.com/test/"></head><body></body></html>';
		const page = makePage({ url: '/test/', html });
		const ctx = makeCtx({ pages: [page], pageSet: new Set(['/test/']) });
		const results = multilingual.analyze(ctx);
		const fails = results.filter((r) => !r.pass) as { pass: false; issue: { code: string } }[];
		assert.ok(!fails.some((r) => r.issue.code === 'hreflang_relative'));
	});

	// hreflang_xdefault — homepage should declare x-default
	it('flags homepage missing x-default hreflang', () => {
		const html =
			'<html><head><link rel="alternate" hreflang="en" href="https://example.com/"></head><body></body></html>';
		const page = makePage({ url: '/', html });
		const ctx = makeCtx({ pages: [page], pageSet: new Set(['/']) });
		const results = multilingual.analyze(ctx);
		const fails = results.filter((r) => !r.pass) as { pass: false; issue: { code: string } }[];
		assert.ok(fails.some((r) => r.issue.code === 'hreflang_xdefault'));
	});

	it('passes homepage with x-default hreflang', () => {
		const html =
			'<html><head>' +
			'<link rel="alternate" hreflang="x-default" href="https://example.com/">' +
			'<link rel="alternate" hreflang="en" href="https://example.com/">' +
			'</head><body></body></html>';
		const page = makePage({ url: '/', html });
		const ctx = makeCtx({ pages: [page], pageSet: new Set(['/']) });
		const results = multilingual.analyze(ctx);
		const fails = results.filter((r) => !r.pass) as { pass: false; issue: { code: string } }[];
		assert.ok(!fails.some((r) => r.issue.code === 'hreflang_xdefault'));
	});

	it('does not require x-default on non-homepage pages', () => {
		const html =
			'<html><head><link rel="alternate" hreflang="en" href="https://example.com/about/"></head><body></body></html>';
		const page = makePage({ url: '/about/', html });
		const ctx = makeCtx({ pages: [page], pageSet: new Set(['/about/']) });
		const results = multilingual.analyze(ctx);
		const fails = results.filter((r) => !r.pass) as { pass: false; issue: { code: string } }[];
		assert.ok(!fails.some((r) => r.issue.code === 'hreflang_xdefault'));
	});

	// hreflang_dead_link
	it('flags hreflang pointing to a page not in pageSet', () => {
		const html =
			'<html><head><link rel="alternate" hreflang="de" href="https://example.com/de/missing/"></head><body></body></html>';
		const page = makePage({ url: '/test/', html });
		// pageSet does not include /de/missing/
		const ctx = makeCtx({ pages: [page], pageSet: new Set(['/test/']) });
		const results = multilingual.analyze(ctx);
		const fails = results.filter((r) => !r.pass) as { pass: false; issue: { code: string } }[];
		assert.ok(fails.some((r) => r.issue.code === 'hreflang_dead_link'));
	});

	it('passes hreflang pointing to an existing page in pageSet', () => {
		const dePageUrl = 'https://example.com/de/test/';
		const html = `<html><head><link rel="alternate" hreflang="de" href="${dePageUrl}"></head><body></body></html>`;
		const page = makePage({ url: '/test/', html });
		const ctx = makeCtx({
			pages: [page],
			pageSet: new Set(['/test/', '/de/test/']),
			config: { name: 'Test', url: 'https://example.com', language: 'en' },
		});
		const results = multilingual.analyze(ctx);
		const fails = results.filter((r) => !r.pass) as { pass: false; issue: { code: string } }[];
		assert.ok(!fails.some((r) => r.issue.code === 'hreflang_dead_link'));
	});

	// hreflang_not_bidirectional
	it('flags non-bidirectional hreflang declaration', () => {
		// Page A declares hreflang to Page B, but Page B does not declare back
		const htmlA =
			'<html><head><link rel="alternate" hreflang="de" href="https://example.com/de/test/"></head><body></body></html>';
		const htmlB = '<html><head></head><body></body></html>'; // no hreflang back to A
		const pageA = makePage({ url: '/test/', html: htmlA });
		const pageB = makePage({ url: '/de/test/', html: htmlB });
		const ctx = makeCtx({
			pages: [pageA, pageB],
			pageSet: new Set(['/test/', '/de/test/']),
			config: { name: 'Test', url: 'https://example.com', language: 'en' },
		});
		const results = multilingual.analyze(ctx);
		const fails = results.filter((r) => !r.pass) as { pass: false; issue: { code: string } }[];
		assert.ok(fails.some((r) => r.issue.code === 'hreflang_not_bidirectional'));
	});

	it('passes bidirectional hreflang declarations', () => {
		const htmlA =
			'<html><head>' +
			'<link rel="alternate" hreflang="en" href="https://example.com/test/">' +
			'<link rel="alternate" hreflang="de" href="https://example.com/de/test/">' +
			'</head><body></body></html>';
		const htmlB =
			'<html><head>' +
			'<link rel="alternate" hreflang="en" href="https://example.com/test/">' +
			'<link rel="alternate" hreflang="de" href="https://example.com/de/test/">' +
			'</head><body></body></html>';
		const pageA = makePage({ url: '/test/', html: htmlA });
		const pageB = makePage({ url: '/de/test/', html: htmlB });
		const ctx = makeCtx({
			pages: [pageA, pageB],
			pageSet: new Set(['/test/', '/de/test/']),
			config: { name: 'Test', url: 'https://example.com', language: 'en' },
		});
		const results = multilingual.analyze(ctx);
		const fails = results.filter((r) => !r.pass) as { pass: false; issue: { code: string } }[];
		assert.ok(!fails.some((r) => r.issue.code === 'hreflang_not_bidirectional'));
	});
});
