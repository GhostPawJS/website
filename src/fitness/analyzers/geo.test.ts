import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { RenderedPage } from '../../types.ts';
import { getLanguageKit } from '../language.ts';
import type { TfidfIndex } from '../tfidf.ts';
import type { SiteContext } from '../types.ts';
import { geo } from './geo.ts';

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

describe('geo analyzer', () => {
	it('always applies', () => {
		assert.ok(geo.applies(makeCtx()));
	});

	// ai_crawler_robots — robots.txt must mention each AI bot
	it('passes when robots.txt mentions all three AI bots', () => {
		const ctx = makeCtx({
			pages: [makePage({ url: '/' })],
			pageSet: new Set(['/']),
			robotsTxt:
				'User-agent: GPTBot\nAllow: /\nUser-agent: ClaudeBot\nAllow: /\nUser-agent: PerplexityBot\nAllow: /',
		});
		const results = geo.analyze(ctx);
		const fails = results.filter((r) => !r.pass) as { pass: false; issue: { code: string } }[];
		const botIssues = fails.filter((r) => r.issue.code === 'ai_crawler_robots');
		assert.equal(botIssues.length, 0);
	});

	it('warns when GPTBot is not in robots.txt', () => {
		const ctx = makeCtx({
			pages: [makePage({ url: '/' })],
			pageSet: new Set(['/']),
			robotsTxt: 'User-agent: *\nAllow: /',
		});
		const results = geo.analyze(ctx);
		const fails = results.filter((r) => !r.pass) as { pass: false; issue: { code: string } }[];
		const botIssues = fails.filter((r) => r.issue.code === 'ai_crawler_robots');
		assert.ok(botIssues.length >= 1);
	});

	it('warns once per missing bot (all three absent)', () => {
		const ctx = makeCtx({
			pages: [],
			pageSet: new Set(),
			robotsTxt: '',
		});
		const results = geo.analyze(ctx);
		const fails = results.filter((r) => !r.pass) as { pass: false; issue: { code: string } }[];
		const botIssues = fails.filter((r) => r.issue.code === 'ai_crawler_robots');
		assert.equal(botIssues.length, 3);
	});

	// direct_answer_structure — interrogative headings
	it('passes when page has interrogative headings', () => {
		const page = makePage({
			wordCount: 600,
			html: '<html><body><h2>What is SEO?</h2><p>SEO is search engine optimization.</p></body></html>',
			textContent: 'What is SEO? SEO is search engine optimization.',
		});
		const ctx = makeCtx({ pages: [page], pageSet: new Set(['/test/']) });
		const results = geo.analyze(ctx);
		const fails = results.filter((r) => !r.pass) as { pass: false; issue: { code: string } }[];
		assert.ok(!fails.some((r) => r.issue.code === 'direct_answer_structure'));
	});

	it('flags page with 500+ words and no interrogative headings', () => {
		const page = makePage({
			wordCount: 600,
			html: `<html><body><h2>Introduction</h2><p>${'word '.repeat(600)}</p></body></html>`,
			textContent: `Introduction ${'word '.repeat(600)}`,
		});
		const ctx = makeCtx({ pages: [page], pageSet: new Set(['/test/']) });
		const results = geo.analyze(ctx);
		const fails = results.filter((r) => !r.pass) as { pass: false; issue: { code: string } }[];
		assert.ok(fails.some((r) => r.issue.code === 'direct_answer_structure'));
	});

	it('skips direct_answer check on pages with fewer than 500 words', () => {
		const page = makePage({
			wordCount: 200,
			html: '<html><body><h2>Introduction</h2><p>Short page content.</p></body></html>',
			textContent: 'Introduction Short page content.',
		});
		const ctx = makeCtx({ pages: [page], pageSet: new Set(['/test/']) });
		const results = geo.analyze(ctx);
		const fails = results.filter((r) => !r.pass) as { pass: false; issue: { code: string } }[];
		assert.ok(!fails.some((r) => r.issue.code === 'direct_answer_structure'));
	});

	// blockquote_citation
	it('flags blockquote without <cite>', () => {
		const page = makePage({
			html: '<html><body><blockquote>Some quoted text.</blockquote></body></html>',
		});
		const ctx = makeCtx({ pages: [page], pageSet: new Set(['/test/']) });
		const results = geo.analyze(ctx);
		const fails = results.filter((r) => !r.pass) as { pass: false; issue: { code: string } }[];
		assert.ok(fails.some((r) => r.issue.code === 'blockquote_citation'));
	});

	it('passes blockquote with <cite> element', () => {
		const page = makePage({
			html: '<html><body><blockquote><cite>Source</cite>Some quoted text.</blockquote></body></html>',
		});
		const ctx = makeCtx({ pages: [page], pageSet: new Set(['/test/']) });
		const results = geo.analyze(ctx);
		const fails = results.filter((r) => !r.pass) as { pass: false; issue: { code: string } }[];
		assert.ok(!fails.some((r) => r.issue.code === 'blockquote_citation'));
	});

	it('passes blockquote with data-source element inside it', () => {
		const page = makePage({
			html: '<html><body><blockquote>Some quoted text.<span data-source="https://example.com"></span></blockquote></body></html>',
		});
		const ctx = makeCtx({ pages: [page], pageSet: new Set(['/test/']) });
		const results = geo.analyze(ctx);
		const fails = results.filter((r) => !r.pass) as { pass: false; issue: { code: string } }[];
		assert.ok(!fails.some((r) => r.issue.code === 'blockquote_citation'));
	});

	// content_freshness_signal
	it('flags page with 300+ words and no freshness signal', () => {
		const page = makePage({
			wordCount: 350,
			html: `<html><body><p>${'word '.repeat(350)}</p></body></html>`,
			textContent: 'word '.repeat(350),
			frontmatter: {},
		});
		const ctx = makeCtx({ pages: [page], pageSet: new Set(['/test/']) });
		const results = geo.analyze(ctx);
		const fails = results.filter((r) => !r.pass) as { pass: false; issue: { code: string } }[];
		assert.ok(fails.some((r) => r.issue.code === 'content_freshness_signal'));
	});

	it('passes page with dateModified in frontmatter', () => {
		const page = makePage({
			wordCount: 350,
			html: `<html><body><p>${'word '.repeat(350)}</p></body></html>`,
			textContent: 'word '.repeat(350),
			frontmatter: { dateModified: '2024-01-15' },
		});
		const ctx = makeCtx({ pages: [page], pageSet: new Set(['/test/']) });
		const results = geo.analyze(ctx);
		const fails = results.filter((r) => !r.pass) as { pass: false; issue: { code: string } }[];
		assert.ok(!fails.some((r) => r.issue.code === 'content_freshness_signal'));
	});

	it('passes page with "updated" text in content', () => {
		const page = makePage({
			wordCount: 350,
			html: `<html><body><p>Last updated January 2024. ${'word '.repeat(350)}</p></body></html>`,
			textContent: `Last updated January 2024. ${'word '.repeat(350)}`,
			frontmatter: {},
		});
		const ctx = makeCtx({ pages: [page], pageSet: new Set(['/test/']) });
		const results = geo.analyze(ctx);
		const fails = results.filter((r) => !r.pass) as { pass: false; issue: { code: string } }[];
		assert.ok(!fails.some((r) => r.issue.code === 'content_freshness_signal'));
	});

	it('skips freshness check on pages with fewer than 300 words', () => {
		const page = makePage({
			wordCount: 100,
			html: '<html><body><p>Short content.</p></body></html>',
			textContent: 'Short content.',
			frontmatter: {},
		});
		const ctx = makeCtx({ pages: [page], pageSet: new Set(['/test/']) });
		const results = geo.analyze(ctx);
		const fails = results.filter((r) => !r.pass) as { pass: false; issue: { code: string } }[];
		assert.ok(!fails.some((r) => r.issue.code === 'content_freshness_signal'));
	});
});
