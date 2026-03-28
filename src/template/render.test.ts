import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { htmlEscape, isTruthy, render, resolvePath } from './render.ts';

// ---------------------------------------------------------------------------
// resolvePath
// ---------------------------------------------------------------------------

describe('resolvePath', () => {
	it('resolves a top-level key', () => {
		assert.equal(resolvePath({ name: 'Alice' }, 'name'), 'Alice');
	});

	it('resolves a dot-notation path', () => {
		assert.equal(resolvePath({ site: { name: 'MyBlog' } }, 'site.name'), 'MyBlog');
	});

	it('resolves a deeply nested path', () => {
		assert.equal(resolvePath({ a: { b: { c: 42 } } }, 'a.b.c'), 42);
	});

	it('returns undefined for missing top-level key', () => {
		assert.equal(resolvePath({}, 'missing'), undefined);
	});

	it('returns undefined when a path segment is null', () => {
		assert.equal(resolvePath({ a: null }, 'a.b'), undefined);
	});

	it('returns undefined when a path segment is not an object', () => {
		assert.equal(resolvePath({ a: 'string' }, 'a.b'), undefined);
	});
});

// ---------------------------------------------------------------------------
// htmlEscape
// ---------------------------------------------------------------------------

describe('htmlEscape', () => {
	it('escapes &', () => assert.equal(htmlEscape('a & b'), 'a &amp; b'));
	it('escapes <', () => assert.equal(htmlEscape('<b>'), '&lt;b&gt;'));
	it('escapes >', () => assert.equal(htmlEscape('1>0'), '1&gt;0'));
	it('escapes "', () => assert.equal(htmlEscape('"hi"'), '&quot;hi&quot;'));
	it("escapes '", () => assert.equal(htmlEscape("it's"), 'it&#39;s'));
	it('leaves safe chars alone', () => assert.equal(htmlEscape('hello world'), 'hello world'));
});

// ---------------------------------------------------------------------------
// isTruthy
// ---------------------------------------------------------------------------

describe('isTruthy', () => {
	it('true is truthy', () => assert.equal(isTruthy(true), true));
	it('false is falsy', () => assert.equal(isTruthy(false), false));
	it('null is falsy', () => assert.equal(isTruthy(null), false));
	it('undefined is falsy', () => assert.equal(isTruthy(undefined), false));
	it('empty string is falsy', () => assert.equal(isTruthy(''), false));
	it('non-empty string is truthy', () => assert.equal(isTruthy('hi'), true));
	it('0 is falsy', () => assert.equal(isTruthy(0), false));
	it('1 is truthy', () => assert.equal(isTruthy(1), true));
	it('empty array is falsy', () => assert.equal(isTruthy([]), false));
	it('non-empty array is truthy', () => assert.equal(isTruthy([1]), true));
	it('object is truthy', () => assert.equal(isTruthy({}), true));
});

// ---------------------------------------------------------------------------
// render — text passthrough
// ---------------------------------------------------------------------------

describe('render — text passthrough', () => {
	it('returns plain HTML unchanged', () => {
		assert.equal(render('<p>Hello</p>', {}), '<p>Hello</p>');
	});

	it('returns empty string for empty template', () => {
		assert.equal(render('', {}), '');
	});
});

// ---------------------------------------------------------------------------
// render — {{ var }} HTML-escaped output
// ---------------------------------------------------------------------------

describe('render — {{ var }}', () => {
	it('interpolates a simple variable', () => {
		assert.equal(render('Hello, {{ name }}!', { name: 'World' }), 'Hello, World!');
	});

	it('HTML-escapes the variable value', () => {
		assert.equal(render('{{ content }}', { content: '<b>bold</b>' }), '&lt;b&gt;bold&lt;/b&gt;');
	});

	it('renders empty string for undefined variable', () => {
		assert.equal(render('{{ missing }}', {}), '');
	});

	it('renders empty string for null variable', () => {
		assert.equal(render('{{ key }}', { key: null }), '');
	});

	it('resolves dot-notation path', () => {
		assert.equal(render('{{ site.name }}', { site: { name: 'Acme' } }), 'Acme');
	});

	it('resolves three-level dot path', () => {
		assert.equal(render('{{ a.b.c }}', { a: { b: { c: 'deep' } } }), 'deep');
	});

	it('renders number as string', () => {
		assert.equal(render('{{ count }}', { count: 42 }), '42');
	});

	it('renders boolean as string', () => {
		assert.equal(render('{{ flag }}', { flag: true }), 'true');
	});
});

// ---------------------------------------------------------------------------
// render — {{{ raw }}} unescaped output
// ---------------------------------------------------------------------------

describe('render — {{{ raw }}}', () => {
	it('renders raw HTML without escaping', () => {
		assert.equal(render('{{{ html }}}', { html: '<b>bold</b>' }), '<b>bold</b>');
	});

	it('renders empty string for undefined raw variable', () => {
		assert.equal(render('{{{ missing }}}', {}), '');
	});

	it('does not double-escape already-escaped content', () => {
		assert.equal(render('{{{ v }}}', { v: '&amp;' }), '&amp;');
	});
});

// ---------------------------------------------------------------------------
// render — {{> partial }}
// ---------------------------------------------------------------------------

describe('render — {{> partial }}', () => {
	it('renders a partial from a record', () => {
		const partials = { 'nav.html': '<nav>{{ site.name }}</nav>' };
		const result = render('{{> "nav.html" }}<main></main>', { site: { name: 'Blog' } }, partials);
		assert.equal(result, '<nav>Blog</nav><main></main>');
	});

	it('returns empty string for missing partial', () => {
		assert.equal(render('{{> "missing.html" }}', {}), '');
	});

	it('renders a partial from a resolver function', () => {
		const resolve = (name: string) => (name === 'head.html' ? '<head></head>' : null);
		assert.equal(render('{{> "head.html" }}', {}, resolve), '<head></head>');
	});

	it('passes context into partial', () => {
		const partials = { 'title.html': '<title>{{ page.title }}</title>' };
		const result = render('{{> "title.html" }}', { page: { title: 'About' } }, partials);
		assert.equal(result, '<title>About</title>');
	});

	it('partial can itself include another partial', () => {
		const partials = {
			'outer.html': 'A{{> "inner.html" }}B',
			'inner.html': 'X',
		};
		assert.equal(render('{{> "outer.html" }}', {}, partials), 'AXB');
	});
});

// ---------------------------------------------------------------------------
// render — {{#each}}
// ---------------------------------------------------------------------------

describe('render — {{#each}}', () => {
	it('iterates over an array', () => {
		const tmpl = '{{#each items as item}}<li>{{ item }}</li>{{/each}}';
		const result = render(tmpl, { items: ['a', 'b', 'c'] });
		assert.equal(result, '<li>a</li><li>b</li><li>c</li>');
	});

	it('renders empty string for empty array', () => {
		const tmpl = '{{#each items as item}}x{{/each}}';
		assert.equal(render(tmpl, { items: [] }), '');
	});

	it('renders empty string when collection is not an array', () => {
		const tmpl = '{{#each items as item}}x{{/each}}';
		assert.equal(render(tmpl, { items: null }), '');
	});

	it('exposes __index inside each', () => {
		const tmpl = '{{#each items as item}}{{ item__index }}{{/each}}';
		assert.equal(render(tmpl, { items: ['a', 'b', 'c'] }), '012');
	});

	it('exposes __first and __last inside each', () => {
		const tmpl =
			'{{#each items as item}}{{#if item__first}}F{{/if}}{{#if item__last}}L{{/if}}{{/each}}';
		assert.equal(render(tmpl, { items: ['a', 'b', 'c'] }), 'FL');
	});

	it('accesses object properties inside each', () => {
		const tmpl = '{{#each users as user}}<b>{{ user.name }}</b>{{/each}}';
		const result = render(tmpl, { users: [{ name: 'Alice' }, { name: 'Bob' }] });
		assert.equal(result, '<b>Alice</b><b>Bob</b>');
	});

	it('inherits parent context inside each', () => {
		const tmpl = '{{#each items as item}}{{ prefix }}-{{ item }}{{/each}}';
		assert.equal(render(tmpl, { prefix: 'tag', items: ['a', 'b'] }), 'tag-atag-b');
	});

	it('resolves dot-notation collection', () => {
		const tmpl = '{{#each page.tags as tag}}{{ tag }}{{/each}}';
		assert.equal(render(tmpl, { page: { tags: ['seo', 'llm'] } }), 'seollm');
	});
});

// ---------------------------------------------------------------------------
// render — {{#if}} / {{else}}
// ---------------------------------------------------------------------------

describe('render — {{#if}}', () => {
	it('renders consequent when condition is truthy', () => {
		assert.equal(render('{{#if show}}yes{{/if}}', { show: true }), 'yes');
	});

	it('renders nothing when condition is falsy', () => {
		assert.equal(render('{{#if show}}yes{{/if}}', { show: false }), '');
	});

	it('renders alternate when condition is falsy', () => {
		assert.equal(render('{{#if show}}yes{{else}}no{{/if}}', { show: false }), 'no');
	});

	it('renders empty string for missing path', () => {
		assert.equal(render('{{#if missing}}yes{{/if}}', {}), '');
	});

	it('negates condition with !', () => {
		assert.equal(render('{{#if !draft}}published{{/if}}', { draft: false }), 'published');
		assert.equal(render('{{#if !draft}}published{{/if}}', { draft: true }), '');
	});

	it('treats empty array as falsy', () => {
		assert.equal(render('{{#if items}}has{{else}}empty{{/if}}', { items: [] }), 'empty');
	});

	it('treats non-empty array as truthy', () => {
		assert.equal(render('{{#if items}}has{{else}}empty{{/if}}', { items: [1] }), 'has');
	});

	it('resolves dot-notation in condition', () => {
		const result = render('{{#if page.draft}}draft{{else}}live{{/if}}', {
			page: { draft: false },
		});
		assert.equal(result, 'live');
	});
});

// ---------------------------------------------------------------------------
// render — nesting
// ---------------------------------------------------------------------------

describe('render — nesting', () => {
	it('nests each inside if', () => {
		const tmpl = '{{#if show}}{{#each items as item}}{{ item }}{{/each}}{{/if}}';
		assert.equal(render(tmpl, { show: true, items: ['a', 'b'] }), 'ab');
		assert.equal(render(tmpl, { show: false, items: ['a', 'b'] }), '');
	});

	it('nests if inside each', () => {
		const tmpl = '{{#each items as item}}{{#if item__last}}LAST{{else}}{{ item }}{{/if}}{{/each}}';
		assert.equal(render(tmpl, { items: ['a', 'b', 'c'] }), 'abLAST');
	});

	it('nests each inside each', () => {
		const tmpl = '{{#each rows as row}}[{{#each row.cells as cell}}{{ cell }}{{/each}}]{{/each}}';
		const ctx = {
			rows: [{ cells: ['a', 'b'] }, { cells: ['c', 'd'] }],
		};
		assert.equal(render(tmpl, ctx), '[ab][cd]');
	});

	it('does not leak alias to outer scope after each', () => {
		const tmpl = '{{#each items as item}}{{ item }}{{/each}}{{ item }}';
		assert.equal(render(tmpl, { items: ['x'], item: 'outer' }), 'xouter');
	});
});

// ---------------------------------------------------------------------------
// render — layout simulation (content slot)
// ---------------------------------------------------------------------------

describe('render — layout chain simulation', () => {
	it('slots inner content via {{{ content }}}', () => {
		const base = '<html><body>{{{ content }}}</body></html>';
		const inner = '<h1>{{ title }}</h1>';
		// Simulate rendering inner first, then slotting into base
		const innerRendered = render(inner, { title: 'Hello' });
		const final = render(base, { content: innerRendered });
		assert.equal(final, '<html><body><h1>Hello</h1></body></html>');
	});
});

// ---------------------------------------------------------------------------
// render — error cases
// ---------------------------------------------------------------------------

describe('render — error cases', () => {
	it('throws on unclosed {{#each}}', () => {
		assert.throws(
			() => render('{{#each items as item}}no close', { items: [] }),
			(err: unknown) => err instanceof Error && err.message.includes('each'),
		);
	});

	it('throws on unclosed {{#if}}', () => {
		assert.throws(
			() => render('{{#if flag}}no close', {}),
			(err: unknown) => err instanceof Error && err.message.includes('if'),
		);
	});

	it('throws on unmatched {{/each}}', () => {
		assert.throws(
			() => render('{{/each}}', {}),
			(err: unknown) => err instanceof Error,
		);
	});

	it('throws on unmatched {{/if}}', () => {
		assert.throws(
			() => render('{{/if}}', {}),
			(err: unknown) => err instanceof Error,
		);
	});
});
