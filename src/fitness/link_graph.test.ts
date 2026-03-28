import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { bfsCrawlDepth, buildLinkGraph } from './link_graph.ts';

const SITE_URL = 'https://example.com';

function page(url: string, links: string[]): { url: string; html: string } {
	const anchors = links.map((href) => `<a href="${href}">Link</a>`).join('\n');
	return { url, html: `<!DOCTYPE html><html><body>${anchors}</body></html>` };
}

describe('buildLinkGraph', () => {
	it('builds outgoing and incoming maps', () => {
		const pages = [page('/', ['/about/']), page('/about/', ['/'])];
		const g = buildLinkGraph(pages, SITE_URL);
		assert.deepEqual(g.outgoing.get('/'), ['/about/']);
		assert.deepEqual(g.outgoing.get('/about/'), ['/']);
		assert.deepEqual(g.incoming.get('/about/'), ['/']);
		assert.deepEqual(g.incoming.get('/'), ['/about/']);
	});

	it('classifies external links separately', () => {
		const pages = [page('/', ['https://other.com/page'])];
		const g = buildLinkGraph(pages, SITE_URL);
		assert.deepEqual(g.externalLinks.get('/'), ['https://other.com/page']);
		assert.deepEqual(g.outgoing.get('/'), []);
	});

	it('deduplicates multiple links to same page', () => {
		const html = '<a href="/about/">A</a><a href="/about/">B</a>';
		const pages = [
			{ url: '/', html },
			{ url: '/about/', html: '' },
		];
		const g = buildLinkGraph(pages, SITE_URL);
		assert.equal(g.outgoing.get('/')?.length, 1);
	});

	it('detects orphan pages (no incoming links, excluding homepage)', () => {
		const pages = [page('/', ['/about/']), page('/about/', []), page('/orphan/', [])];
		const g = buildLinkGraph(pages, SITE_URL);
		assert.ok(g.orphans.includes('/orphan/'));
		assert.ok(!g.orphans.includes('/about/'));
		assert.ok(!g.orphans.includes('/'));
	});

	it('handles absolute internal links', () => {
		const pages = [
			{ url: '/', html: `<a href="${SITE_URL}/products/">Products</a>` },
			{ url: '/products/', html: '' },
		];
		const g = buildLinkGraph(pages, SITE_URL);
		assert.deepEqual(g.outgoing.get('/'), ['/products/']);
	});

	it('normalizes paths with trailing slash', () => {
		const pages = [
			{ url: '/', html: '<a href="/about">About</a>' },
			{ url: '/about/', html: '' },
		];
		const g = buildLinkGraph(pages, SITE_URL);
		assert.deepEqual(g.outgoing.get('/'), ['/about/']);
	});

	it('skips hash and mailto links', () => {
		const pages = [
			{ url: '/', html: '<a href="#section">Sec</a><a href="mailto:x@y.com">Email</a>' },
		];
		const g = buildLinkGraph(pages, SITE_URL);
		assert.deepEqual(g.outgoing.get('/'), []);
	});

	it('builds crawl depth from homepage', () => {
		const pages = [page('/', ['/a/']), page('/a/', ['/b/']), page('/b/', [])];
		const g = buildLinkGraph(pages, SITE_URL);
		assert.equal(g.depth.get('/'), 0);
		assert.equal(g.depth.get('/a/'), 1);
		assert.equal(g.depth.get('/b/'), 2);
	});

	it('marks unreachable pages as Infinity depth', () => {
		const pages = [page('/', []), page('/unreachable/', [])];
		const g = buildLinkGraph(pages, SITE_URL);
		assert.equal(g.depth.get('/unreachable/'), Infinity);
	});

	it('records anchor texts', () => {
		const pages = [
			{ url: '/', html: '<a href="/about/">About Us</a>' },
			{ url: '/about/', html: '' },
		];
		const g = buildLinkGraph(pages, SITE_URL);
		const texts = g.anchorTexts.get('/')?.get('/about/');
		assert.deepEqual(texts, ['About Us']);
	});
});

describe('bfsCrawlDepth', () => {
	it('computes depths from start node', () => {
		const adj = new Map([
			['/', ['/a/', '/b/']],
			['/a/', ['/c/']],
			['/b/', []],
			['/c/', []],
		]);
		const depth = bfsCrawlDepth(adj, '/');
		assert.equal(depth.get('/'), 0);
		assert.equal(depth.get('/a/'), 1);
		assert.equal(depth.get('/b/'), 1);
		assert.equal(depth.get('/c/'), 2);
	});

	it('handles disconnected nodes', () => {
		const adj = new Map([
			['/', []],
			['/orphan/', []],
		]);
		const depth = bfsCrawlDepth(adj, '/');
		assert.equal(depth.get('/'), 0);
		assert.equal(depth.get('/orphan/'), Infinity);
	});
});
