import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { RenderedPage } from '../../types.ts';
import { getLanguageKit } from '../language.ts';
import type { TfidfIndex } from '../tfidf.ts';
import type { SiteContext } from '../types.ts';
import { searchConsole } from './search_console.ts';

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

describe('search_console analyzer', () => {
	// applies() gating
	it('does not apply when searchConsole data is absent', () => {
		assert.ok(!searchConsole.applies(makeCtx()));
	});

	it('does not apply when searchConsole has an empty rows array', () => {
		const ctx = makeCtx({ searchConsole: { rows: [] } });
		assert.ok(!searchConsole.applies(ctx));
	});

	it('applies when searchConsole has at least one row', () => {
		const ctx = makeCtx({
			searchConsole: {
				rows: [
					{
						page: '/test/',
						query: 'test query',
						clicks: 5,
						impressions: 200,
						ctr: 0.025,
						position: 3,
					},
				],
			},
		});
		assert.ok(searchConsole.applies(ctx));
	});

	// low_ctr — position 1 with impressions >= 100 and CTR < 50% of expected (30%)
	it('flags underperforming CTR at position 1', () => {
		// Expected CTR for pos 1 is 30%; actual 1% < 15% (50% of 30%) — should flag
		const ctx = makeCtx({
			pages: [makePage({ url: '/test/' })],
			pageSet: new Set(['/test/']),
			searchConsole: {
				rows: [
					{
						page: '/test/',
						query: 'main keyword',
						clicks: 5,
						impressions: 500,
						ctr: 0.01,
						position: 1,
					},
				],
			},
		});
		const results = searchConsole.analyze(ctx);
		const fails = results.filter((r) => !r.pass) as { pass: false; issue: { code: string } }[];
		assert.ok(fails.some((r) => r.issue.code === 'low_ctr'));
	});

	it('passes when CTR meets the expected threshold at position 1', () => {
		// Expected CTR for pos 1 is 30%; actual 30% >= 15% — should pass
		const ctx = makeCtx({
			pages: [makePage({ url: '/test/' })],
			pageSet: new Set(['/test/']),
			searchConsole: {
				rows: [
					{
						page: '/test/',
						query: 'main keyword',
						clicks: 150,
						impressions: 500,
						ctr: 0.3,
						position: 1,
					},
				],
			},
		});
		const results = searchConsole.analyze(ctx);
		const fails = results.filter((r) => !r.pass) as { pass: false; issue: { code: string } }[];
		assert.ok(!fails.some((r) => r.issue.code === 'low_ctr'));
	});

	it('skips low_ctr check when impressions are below 100', () => {
		// Only 50 impressions — below threshold
		const ctx = makeCtx({
			pages: [makePage({ url: '/test/' })],
			pageSet: new Set(['/test/']),
			searchConsole: {
				rows: [
					{
						page: '/test/',
						query: 'rare term',
						clicks: 0,
						impressions: 50,
						ctr: 0.0,
						position: 1,
					},
				],
			},
		});
		const results = searchConsole.analyze(ctx);
		const fails = results.filter((r) => !r.pass) as { pass: false; issue: { code: string } }[];
		assert.ok(!fails.some((r) => r.issue.code === 'low_ctr'));
	});

	// keyword_opportunity — position 4-10 with >= 200 impressions
	it('flags keyword opportunity at position 7 with 300 impressions', () => {
		const ctx = makeCtx({
			pages: [makePage({ url: '/test/' })],
			pageSet: new Set(['/test/']),
			searchConsole: {
				rows: [
					{
						page: '/test/',
						query: 'opportunity keyword',
						clicks: 10,
						impressions: 300,
						ctr: 0.033,
						position: 7,
					},
				],
			},
		});
		const results = searchConsole.analyze(ctx);
		const fails = results.filter((r) => !r.pass) as { pass: false; issue: { code: string } }[];
		assert.ok(fails.some((r) => r.issue.code === 'keyword_opportunity'));
	});

	it('does not flag keyword_opportunity for position <= 3', () => {
		const ctx = makeCtx({
			pages: [makePage({ url: '/test/' })],
			pageSet: new Set(['/test/']),
			searchConsole: {
				rows: [
					{
						page: '/test/',
						query: 'top keyword',
						clicks: 80,
						impressions: 300,
						ctr: 0.27,
						position: 2,
					},
				],
			},
		});
		const results = searchConsole.analyze(ctx);
		const fails = results.filter((r) => !r.pass) as { pass: false; issue: { code: string } }[];
		assert.ok(!fails.some((r) => r.issue.code === 'keyword_opportunity'));
	});

	it('does not flag keyword_opportunity when impressions are below 200', () => {
		const ctx = makeCtx({
			pages: [makePage({ url: '/test/' })],
			pageSet: new Set(['/test/']),
			searchConsole: {
				rows: [
					{
						page: '/test/',
						query: 'low volume term',
						clicks: 3,
						impressions: 100,
						ctr: 0.03,
						position: 6,
					},
				],
			},
		});
		const results = searchConsole.analyze(ctx);
		const fails = results.filter((r) => !r.pass) as { pass: false; issue: { code: string } }[];
		assert.ok(!fails.some((r) => r.issue.code === 'keyword_opportunity'));
	});

	// content_gap — query with >= 50 total impressions and no dedicated page URL match
	it('flags content_gap for high-impression query with no matching page URL', () => {
		const ctx = makeCtx({
			pages: [],
			pageSet: new Set(),
			searchConsole: {
				rows: [
					{
						page: '/test/',
						query: 'completely new topic',
						clicks: 2,
						impressions: 100,
						ctr: 0.02,
						position: 15,
					},
				],
			},
		});
		const results = searchConsole.analyze(ctx);
		const fails = results.filter((r) => !r.pass) as { pass: false; issue: { code: string } }[];
		assert.ok(fails.some((r) => r.issue.code === 'content_gap'));
	});

	it('does not flag content_gap when a page URL contains a query word', () => {
		const ctx = makeCtx({
			pages: [makePage({ url: '/topic-guide/' })],
			pageSet: new Set(['/topic-guide/']),
			searchConsole: {
				rows: [
					{
						page: '/topic-guide/',
						query: 'topic guide',
						clicks: 5,
						impressions: 80,
						ctr: 0.06,
						position: 12,
					},
				],
			},
		});
		const results = searchConsole.analyze(ctx);
		const fails = results.filter((r) => !r.pass) as { pass: false; issue: { code: string } }[];
		assert.ok(!fails.some((r) => r.issue.code === 'content_gap'));
	});

	it('does not flag content_gap when query has fewer than 50 impressions', () => {
		const ctx = makeCtx({
			pages: [],
			pageSet: new Set(),
			searchConsole: {
				rows: [
					{
						page: '/test/',
						query: 'very rare niche query',
						clicks: 0,
						impressions: 20,
						ctr: 0.0,
						position: 20,
					},
				],
			},
		});
		const results = searchConsole.analyze(ctx);
		const fails = results.filter((r) => !r.pass) as { pass: false; issue: { code: string } }[];
		assert.ok(!fails.some((r) => r.issue.code === 'content_gap'));
	});

	// url_flickering — same query served by 2+ pages each with >= 20 impressions
	it('flags url_flickering when two pages share the same query with significant impressions', () => {
		const ctx = makeCtx({
			pages: [makePage({ url: '/page-a/' }), makePage({ url: '/page-b/' })],
			pageSet: new Set(['/page-a/', '/page-b/']),
			searchConsole: {
				rows: [
					{
						page: '/page-a/',
						query: 'shared keyword',
						clicks: 5,
						impressions: 30,
						ctr: 0.17,
						position: 3,
					},
					{
						page: '/page-b/',
						query: 'shared keyword',
						clicks: 4,
						impressions: 25,
						ctr: 0.16,
						position: 4,
					},
				],
			},
		});
		const results = searchConsole.analyze(ctx);
		const fails = results.filter((r) => !r.pass) as { pass: false; issue: { code: string } }[];
		assert.ok(fails.some((r) => r.issue.code === 'url_flickering'));
	});

	it('does not flag url_flickering when only one page has significant impressions', () => {
		// Page B has only 5 impressions (< 20 threshold)
		const ctx = makeCtx({
			pages: [makePage({ url: '/page-a/' }), makePage({ url: '/page-b/' })],
			pageSet: new Set(['/page-a/', '/page-b/']),
			searchConsole: {
				rows: [
					{
						page: '/page-a/',
						query: 'dominant keyword',
						clicks: 30,
						impressions: 200,
						ctr: 0.15,
						position: 2,
					},
					{
						page: '/page-b/',
						query: 'dominant keyword',
						clicks: 0,
						impressions: 5,
						ctr: 0.0,
						position: 18,
					},
				],
			},
		});
		const results = searchConsole.analyze(ctx);
		const fails = results.filter((r) => !r.pass) as { pass: false; issue: { code: string } }[];
		assert.ok(!fails.some((r) => r.issue.code === 'url_flickering'));
	});

	it('flags url_flickering correctly identifies the cannibalizing pages', () => {
		const ctx = makeCtx({
			pages: [makePage({ url: '/article/' }), makePage({ url: '/blog/article/' })],
			pageSet: new Set(['/article/', '/blog/article/']),
			searchConsole: {
				rows: [
					{
						page: '/article/',
						query: 'duplicate content',
						clicks: 10,
						impressions: 50,
						ctr: 0.2,
						position: 3,
					},
					{
						page: '/blog/article/',
						query: 'duplicate content',
						clicks: 8,
						impressions: 40,
						ctr: 0.2,
						position: 4,
					},
				],
			},
		});
		const results = searchConsole.analyze(ctx);
		const fails = results.filter((r) => !r.pass) as {
			pass: false;
			issue: { code: string; message: string };
		}[];
		const flickerIssues = fails.filter((r) => r.issue.code === 'url_flickering');
		assert.ok(flickerIssues.length >= 1);
		assert.ok(flickerIssues[0]?.issue.message.includes('duplicate content'));
	});
});
