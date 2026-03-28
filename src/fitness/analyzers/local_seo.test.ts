import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { RenderedPage } from '../../types.ts';
import { getLanguageKit } from '../language.ts';
import type { TfidfIndex } from '../tfidf.ts';
import type { SiteContext } from '../types.ts';
import { localSeo } from './local_seo.ts';

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

describe('local_seo analyzer', () => {
	// applies() gating
	it('does not apply when no LocalBusiness schema present', () => {
		const page = makePage({ html: '<html><body><p>No schema here.</p></body></html>' });
		const ctx = makeCtx({ pages: [page], pageSet: new Set([page.url]) });
		assert.ok(!localSeo.applies(ctx));
	});

	it('does not apply when no pages', () => {
		assert.ok(!localSeo.applies(makeCtx()));
	});

	it('applies when LocalBusiness schema is present', () => {
		const html =
			'<html><body><script type="application/ld+json">{"@type":"LocalBusiness","name":"Test"}</script></body></html>';
		const page = makePage({ html });
		const ctx = makeCtx({ pages: [page], pageSet: new Set([page.url]) });
		assert.ok(localSeo.applies(ctx));
	});

	it('applies when Restaurant schema is present', () => {
		const html =
			'<html><body><script type="application/ld+json">{"@type":"Restaurant","name":"Joe\'s"}</script></body></html>';
		const page = makePage({ html });
		const ctx = makeCtx({ pages: [page], pageSet: new Set([page.url]) });
		assert.ok(localSeo.applies(ctx));
	});

	it('applies when Hotel schema is present', () => {
		const html =
			'<html><body><script type="application/ld+json">{"@type":"Hotel","name":"Grand Hotel"}</script></body></html>';
		const page = makePage({ html });
		const ctx = makeCtx({ pages: [page], pageSet: new Set([page.url]) });
		assert.ok(localSeo.applies(ctx));
	});

	// missing_nap
	it('flags missing NAP fields when all three are absent', () => {
		const html =
			'<html><body><script type="application/ld+json">{"@type":"LocalBusiness"}</script></body></html>';
		const page = makePage({ html });
		const ctx = makeCtx({ pages: [page], pageSet: new Set([page.url]) });
		const results = localSeo.analyze(ctx);
		const fails = results.filter((r) => !r.pass) as { pass: false; issue: { code: string } }[];
		assert.ok(fails.some((r) => r.issue.code === 'missing_nap'));
	});

	it('flags missing NAP when only name is present', () => {
		const schema = JSON.stringify({ '@type': 'LocalBusiness', name: 'Test Business' });
		const html = `<html><body><script type="application/ld+json">${schema}</script></body></html>`;
		const page = makePage({ html });
		const ctx = makeCtx({ pages: [page], pageSet: new Set([page.url]) });
		const results = localSeo.analyze(ctx);
		const fails = results.filter((r) => !r.pass) as { pass: false; issue: { code: string } }[];
		assert.ok(fails.some((r) => r.issue.code === 'missing_nap'));
	});

	it('passes with complete NAP (name, address, telephone)', () => {
		const schema = JSON.stringify({
			'@type': 'LocalBusiness',
			name: 'Test Business',
			address: '123 Main St',
			telephone: '+1-555-0100',
		});
		const html = `<html><body><a href="tel:+15550100">Call</a><script type="application/ld+json">${schema}</script></body></html>`;
		const page = makePage({ html });
		const ctx = makeCtx({ pages: [page], pageSet: new Set([page.url]) });
		const results = localSeo.analyze(ctx);
		const fails = results.filter((r) => !r.pass) as { pass: false; issue: { code: string } }[];
		assert.ok(!fails.some((r) => r.issue.code === 'missing_nap'));
	});

	// no_tel_link
	it('flags missing clickable telephone link in HTML', () => {
		const schema = JSON.stringify({
			'@type': 'LocalBusiness',
			name: 'Test',
			address: '123 Main St',
			telephone: '+1-555-0100',
		});
		const html = `<html><body><script type="application/ld+json">${schema}</script></body></html>`;
		const page = makePage({ html });
		const ctx = makeCtx({ pages: [page], pageSet: new Set([page.url]) });
		const results = localSeo.analyze(ctx);
		const fails = results.filter((r) => !r.pass) as { pass: false; issue: { code: string } }[];
		assert.ok(fails.some((r) => r.issue.code === 'no_tel_link'));
	});

	it('passes when tel: link is present in HTML', () => {
		const schema = JSON.stringify({
			'@type': 'LocalBusiness',
			name: 'Test',
			address: '123 Main St',
			telephone: '+1-555-0100',
		});
		const html = `<html><body><a href="tel:+15550100">Call us</a><script type="application/ld+json">${schema}</script></body></html>`;
		const page = makePage({ html });
		const ctx = makeCtx({ pages: [page], pageSet: new Set([page.url]) });
		const results = localSeo.analyze(ctx);
		const fails = results.filter((r) => !r.pass) as { pass: false; issue: { code: string } }[];
		assert.ok(!fails.some((r) => r.issue.code === 'no_tel_link'));
	});

	// missing_opening_hours
	it('flags missing opening hours', () => {
		const schema = JSON.stringify({
			'@type': 'LocalBusiness',
			name: 'Test',
			address: '123 Main St',
			telephone: '+1-555-0100',
		});
		const html = `<html><body><a href="tel:+15550100">Call</a><script type="application/ld+json">${schema}</script></body></html>`;
		const page = makePage({ html });
		const ctx = makeCtx({ pages: [page], pageSet: new Set([page.url]) });
		const results = localSeo.analyze(ctx);
		const fails = results.filter((r) => !r.pass) as { pass: false; issue: { code: string } }[];
		assert.ok(fails.some((r) => r.issue.code === 'missing_opening_hours'));
	});

	it('passes when openingHours is present', () => {
		const schema = JSON.stringify({
			'@type': 'LocalBusiness',
			name: 'Test',
			address: '123 Main St',
			telephone: '+1-555-0100',
			openingHours: 'Mo-Fr 09:00-18:00',
		});
		const html = `<html><body><a href="tel:+15550100">Call</a><script type="application/ld+json">${schema}</script></body></html>`;
		const page = makePage({ html });
		const ctx = makeCtx({ pages: [page], pageSet: new Set([page.url]) });
		const results = localSeo.analyze(ctx);
		const fails = results.filter((r) => !r.pass) as { pass: false; issue: { code: string } }[];
		assert.ok(!fails.some((r) => r.issue.code === 'missing_opening_hours'));
	});

	// missing_geo_coordinates
	it('flags missing geo coordinates', () => {
		const schema = JSON.stringify({
			'@type': 'LocalBusiness',
			name: 'Test',
			address: '123 Main St',
			telephone: '+1-555-0100',
			openingHours: 'Mo-Fr 09:00-18:00',
		});
		const html = `<html><body><a href="tel:+15550100">Call</a><script type="application/ld+json">${schema}</script></body></html>`;
		const page = makePage({ html });
		const ctx = makeCtx({ pages: [page], pageSet: new Set([page.url]) });
		const results = localSeo.analyze(ctx);
		const fails = results.filter((r) => !r.pass) as { pass: false; issue: { code: string } }[];
		assert.ok(fails.some((r) => r.issue.code === 'missing_geo_coordinates'));
	});

	it('passes when geo coordinates are present', () => {
		const schema = JSON.stringify({
			'@type': 'LocalBusiness',
			name: 'Test',
			address: '123 Main St',
			telephone: '+1-555-0100',
			openingHours: 'Mo-Fr 09:00-18:00',
			geo: { '@type': 'GeoCoordinates', latitude: 40.7128, longitude: -74.006 },
		});
		const html = `<html><body><a href="tel:+15550100">Call</a><script type="application/ld+json">${schema}</script></body></html>`;
		const page = makePage({ html });
		const ctx = makeCtx({ pages: [page], pageSet: new Set([page.url]) });
		const results = localSeo.analyze(ctx);
		const fails = results.filter((r) => !r.pass) as { pass: false; issue: { code: string } }[];
		assert.ok(!fails.some((r) => r.issue.code === 'missing_geo_coordinates'));
	});

	// restaurant_missing_field
	it('flags restaurant schema missing menu, servesCuisine, and priceRange', () => {
		const schema = JSON.stringify({
			'@type': 'Restaurant',
			name: "Joe's",
			address: '123 Main',
			telephone: '+1-555-0100',
		});
		const html = `<html><body><a href="tel:+15550100">Call</a><script type="application/ld+json">${schema}</script></body></html>`;
		const page = makePage({ html });
		const ctx = makeCtx({ pages: [page], pageSet: new Set([page.url]) });
		const results = localSeo.analyze(ctx);
		const fails = results.filter((r) => !r.pass) as { pass: false; issue: { code: string } }[];
		assert.ok(fails.some((r) => r.issue.code === 'restaurant_missing_field'));
	});

	it('passes restaurant schema with all required fields', () => {
		const schema = JSON.stringify({
			'@type': 'Restaurant',
			name: "Joe's Bistro",
			address: '123 Main St',
			telephone: '+1-555-0100',
			openingHours: 'Mo-Su 11:00-22:00',
			geo: { '@type': 'GeoCoordinates', latitude: 40.7, longitude: -74.0 },
			menu: 'https://example.com/menu',
			servesCuisine: 'Italian',
			priceRange: '$$',
		});
		const html = `<html><body><a href="tel:+15550100">Call</a><script type="application/ld+json">${schema}</script></body></html>`;
		const page = makePage({ html });
		const ctx = makeCtx({ pages: [page], pageSet: new Set([page.url]) });
		const results = localSeo.analyze(ctx);
		const fails = results.filter((r) => !r.pass) as { pass: false; issue: { code: string } }[];
		assert.ok(!fails.some((r) => r.issue.code === 'restaurant_missing_field'));
	});

	// nap_inconsistent — multiple pages with different NAP
	it('flags NAP inconsistency across multiple pages', () => {
		const schema1 = JSON.stringify({
			'@type': 'LocalBusiness',
			name: 'Test Business',
			address: '123 Main St',
			telephone: '+1-555-0100',
			openingHours: 'Mo-Fr 09:00-18:00',
			geo: { '@type': 'GeoCoordinates', latitude: 40.7, longitude: -74.0 },
		});
		const schema2 = JSON.stringify({
			'@type': 'LocalBusiness',
			name: 'Test Business Different',
			address: '456 Other Ave',
			telephone: '+1-555-0200',
			openingHours: 'Mo-Fr 09:00-18:00',
			geo: { '@type': 'GeoCoordinates', latitude: 40.7, longitude: -74.0 },
		});
		const page1 = makePage({
			url: '/contact/',
			html: `<html><body><a href="tel:+15550100">Call</a><script type="application/ld+json">${schema1}</script></body></html>`,
		});
		const page2 = makePage({
			url: '/about/',
			html: `<html><body><a href="tel:+15550200">Call</a><script type="application/ld+json">${schema2}</script></body></html>`,
		});
		const ctx = makeCtx({
			pages: [page1, page2],
			pageSet: new Set(['/contact/', '/about/']),
		});
		const results = localSeo.analyze(ctx);
		const fails = results.filter((r) => !r.pass) as { pass: false; issue: { code: string } }[];
		assert.ok(fails.some((r) => r.issue.code === 'nap_inconsistent'));
	});
});
