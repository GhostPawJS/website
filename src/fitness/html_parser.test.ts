import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	getDuplicateIds,
	getHeadings,
	getHtmlLang,
	getImages,
	getJsonLd,
	getLinks,
	getMetaName,
	getMetaProperty,
	getTitle,
	hasBodyInlineScripts,
	hasBodyInlineStyles,
	hasDoctype,
	stripTags,
} from './html_parser.ts';

describe('getTitle', () => {
	it('extracts title', () => {
		assert.equal(getTitle('<title>Hello World</title>'), 'Hello World');
	});
	it('returns empty for missing title', () => {
		assert.equal(getTitle('<html><body></body></html>'), '');
	});
	it('returns content with whitespace preserved', () => {
		const result = getTitle('<title>  Trimmed  </title>');
		assert.ok(result.includes('Trimmed'));
	});
});

describe('getMetaName', () => {
	it('extracts description', () => {
		const html = '<meta name="description" content="A page about X.">';
		assert.equal(getMetaName(html, 'description'), 'A page about X.');
	});
	it('returns empty when not found', () => {
		assert.equal(getMetaName('<html></html>', 'keywords'), '');
	});
	it('handles single-quoted content', () => {
		assert.equal(getMetaName("<meta name='description' content='test'>", 'description'), 'test');
	});
});

describe('getMetaProperty', () => {
	it('extracts og:title', () => {
		assert.equal(
			getMetaProperty('<meta property="og:title" content="OG Title">', 'og:title'),
			'OG Title',
		);
	});
});

describe('getLinks', () => {
	it('extracts href and text', () => {
		const links = getLinks('<a href="/about">About Us</a>');
		assert.equal(links.length, 1);
		assert.equal(links[0]?.href, '/about');
		assert.equal(links[0]?.text, 'About Us');
	});
	it('handles rel and target attributes', () => {
		const links = getLinks('<a href="https://ext.com" rel="noopener" target="_blank">Ext</a>');
		assert.equal(links[0]?.rel, 'noopener');
		assert.equal(links[0]?.target, '_blank');
	});
	it('skips anchors without href', () => {
		const links = getLinks('<a name="anchor">Section</a>');
		assert.equal(links.length, 0);
	});
	it('returns empty array for no links', () => {
		assert.equal(getLinks('<p>No links here</p>').length, 0);
	});
});

describe('getImages', () => {
	it('extracts src and alt', () => {
		const imgs = getImages('<img src="/img/photo.jpg" alt="A photo" width="800" height="600">');
		assert.equal(imgs.length, 1);
		assert.equal(imgs[0]?.src, '/img/photo.jpg');
		assert.equal(imgs[0]?.alt, 'A photo');
		assert.equal(imgs[0]?.width, '800');
	});
	it('handles self-closing syntax', () => {
		const imgs = getImages('<img src="/x.png" alt="X" />');
		assert.equal(imgs.length, 1);
	});
	it('returns empty for no images', () => {
		assert.equal(getImages('<p>text</p>').length, 0);
	});
});

describe('getHeadings', () => {
	it('extracts heading levels and text', () => {
		const html = '<h1>Title</h1><h2>Sub</h2><h3>Deep</h3>';
		const headings = getHeadings(html);
		assert.equal(headings.length, 3);
		assert.equal(headings[0]?.level, 1);
		assert.equal(headings[0]?.text, 'Title');
		assert.equal(headings[1]?.level, 2);
		assert.equal(headings[2]?.level, 3);
	});
	it('strips tags inside headings', () => {
		const html = '<h2><a href="/x">Link Text</a></h2>';
		assert.equal(getHeadings(html)[0]?.text, 'Link Text');
	});
});

describe('getJsonLd', () => {
	it('parses valid JSON-LD block', () => {
		const html = '<script type="application/ld+json">{"@type":"Article","name":"Test"}</script>';
		const schemas = getJsonLd(html);
		assert.equal(schemas.length, 1);
		assert.deepEqual(schemas[0], { '@type': 'Article', name: 'Test' });
	});
	it('skips malformed JSON', () => {
		const html = '<script type="application/ld+json">{broken}</script>';
		assert.equal(getJsonLd(html).length, 0);
	});
	it('returns empty for no JSON-LD blocks', () => {
		assert.equal(getJsonLd('<html></html>').length, 0);
	});
	it('handles multiple blocks', () => {
		const html = `
			<script type="application/ld+json">{"@type":"Article"}</script>
			<script type="application/ld+json">{"@type":"BreadcrumbList"}</script>
		`;
		assert.equal(getJsonLd(html).length, 2);
	});
});

describe('hasDoctype', () => {
	it('detects standard doctype', () => {
		assert.equal(hasDoctype('<!DOCTYPE html><html></html>'), true);
	});
	it('detects case-insensitive doctype', () => {
		assert.equal(hasDoctype('<!doctype html><html></html>'), true);
	});
	it('returns false when missing', () => {
		assert.equal(hasDoctype('<html></html>'), false);
	});
});

describe('hasBodyInlineStyles / hasBodyInlineScripts', () => {
	it('detects inline style in body', () => {
		const html = '<html><body><style>.x{color:red}</style></body></html>';
		assert.equal(hasBodyInlineStyles(html), true);
	});
	it('no inline styles → false', () => {
		assert.equal(
			hasBodyInlineStyles('<html><head><style>*{}</style></head><body></body></html>'),
			false,
		);
	});
	it('detects inline scripts in body (non-JSON-LD)', () => {
		const html = '<html><body><script>alert(1)</script></body></html>';
		assert.equal(hasBodyInlineScripts(html), true);
	});
	it('JSON-LD scripts not flagged', () => {
		const html = '<body><script type="application/ld+json">{}</script></body>';
		assert.equal(hasBodyInlineScripts(html), false);
	});
});

describe('getDuplicateIds', () => {
	it('finds duplicate IDs', () => {
		const html = '<div id="foo">A</div><div id="foo">B</div><div id="bar"></div>';
		const dups = getDuplicateIds(html);
		assert.ok(dups.includes('foo'));
		assert.ok(!dups.includes('bar'));
	});
	it('returns empty for unique IDs', () => {
		assert.equal(getDuplicateIds('<div id="a"></div><div id="b"></div>').length, 0);
	});
});

describe('getHtmlLang', () => {
	it('extracts lang attribute', () => {
		assert.equal(getHtmlLang('<html lang="de"><body></body></html>'), 'de');
	});
	it('returns empty when no lang', () => {
		assert.equal(getHtmlLang('<html><body></body></html>'), '');
	});
});

describe('stripTags', () => {
	it('strips HTML tags', () => {
		assert.equal(stripTags('<p>Hello <strong>world</strong></p>'), 'Hello world');
	});
	it('handles empty string', () => {
		assert.equal(stripTags(''), '');
	});
	it('leaves plain text unchanged', () => {
		assert.equal(stripTags('plain text'), 'plain text');
	});
});
