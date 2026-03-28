import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { tokenize } from './tokenize.ts';

describe('tokenize — text passthrough', () => {
	it('returns a single text token for plain HTML', () => {
		const tokens = tokenize('<p>Hello</p>');
		assert.deepEqual(tokens, [{ type: 'text', value: '<p>Hello</p>' }]);
	});

	it('returns empty array for empty string', () => {
		assert.deepEqual(tokenize(''), []);
	});
});

describe('tokenize — variable tags', () => {
	it('tokenizes a single {{ var }} tag', () => {
		const tokens = tokenize('{{ name }}');
		assert.deepEqual(tokens, [{ type: 'var', path: 'name' }]);
	});

	it('tokenizes {{ var }} surrounded by text', () => {
		const tokens = tokenize('<p>Hello, {{ name }}!</p>');
		assert.deepEqual(tokens, [
			{ type: 'text', value: '<p>Hello, ' },
			{ type: 'var', path: 'name' },
			{ type: 'text', value: '!</p>' },
		]);
	});

	it('tokenizes dot-notation path', () => {
		const tokens = tokenize('{{ site.name }}');
		assert.deepEqual(tokens, [{ type: 'var', path: 'site.name' }]);
	});

	it('tokenizes deeply nested dot path', () => {
		const tokens = tokenize('{{ a.b.c }}');
		assert.deepEqual(tokens, [{ type: 'var', path: 'a.b.c' }]);
	});

	it('tokenizes multiple variable tags', () => {
		const tokens = tokenize('{{ a }}-{{ b }}');
		assert.deepEqual(tokens, [
			{ type: 'var', path: 'a' },
			{ type: 'text', value: '-' },
			{ type: 'var', path: 'b' },
		]);
	});
});

describe('tokenize — raw tags', () => {
	it('tokenizes a {{{ raw }}} tag', () => {
		const tokens = tokenize('{{{ content }}}');
		assert.deepEqual(tokens, [{ type: 'raw', path: 'content' }]);
	});

	it('does not confuse {{ }} with {{{ }}}', () => {
		const tokens = tokenize('{{{ html }}} {{ text }}');
		assert.deepEqual(tokens, [
			{ type: 'raw', path: 'html' },
			{ type: 'text', value: ' ' },
			{ type: 'var', path: 'text' },
		]);
	});
});

describe('tokenize — partial tags', () => {
	it('tokenizes {{> "partial.html" }}', () => {
		const tokens = tokenize('{{> "nav.html" }}');
		assert.deepEqual(tokens, [{ type: 'partial', name: 'nav.html' }]);
	});

	it('tokenizes {{> partial.html }} without quotes', () => {
		const tokens = tokenize('{{> nav.html }}');
		assert.deepEqual(tokens, [{ type: 'partial', name: 'nav.html' }]);
	});

	it('tokenizes single-quoted partial', () => {
		const tokens = tokenize("{{> 'footer.html' }}");
		assert.deepEqual(tokens, [{ type: 'partial', name: 'footer.html' }]);
	});
});

describe('tokenize — each tags', () => {
	it('tokenizes {{#each}} and {{/each}}', () => {
		const tokens = tokenize('{{#each items as item}}x{{/each}}');
		assert.deepEqual(tokens, [
			{ type: 'each_open', collection: 'items', alias: 'item' },
			{ type: 'text', value: 'x' },
			{ type: 'each_close' },
		]);
	});

	it('tokenizes dot-notation collection in each', () => {
		const tokens = tokenize('{{#each data.posts as post}}{{/each}}');
		assert.deepEqual(tokens, [
			{ type: 'each_open', collection: 'data.posts', alias: 'post' },
			{ type: 'each_close' },
		]);
	});
});

describe('tokenize — if/else tags', () => {
	it('tokenizes {{#if}} and {{/if}}', () => {
		const tokens = tokenize('{{#if flag}}yes{{/if}}');
		assert.deepEqual(tokens, [
			{ type: 'if_open', condition: 'flag' },
			{ type: 'text', value: 'yes' },
			{ type: 'if_close' },
		]);
	});

	it('tokenizes {{#if}} with {{else}} and {{/if}}', () => {
		const tokens = tokenize('{{#if flag}}yes{{else}}no{{/if}}');
		assert.deepEqual(tokens, [
			{ type: 'if_open', condition: 'flag' },
			{ type: 'text', value: 'yes' },
			{ type: 'else' },
			{ type: 'text', value: 'no' },
			{ type: 'if_close' },
		]);
	});

	it('tokenizes negated condition', () => {
		const tokens = tokenize('{{#if !draft}}published{{/if}}');
		assert.deepEqual(tokens, [
			{ type: 'if_open', condition: '!draft' },
			{ type: 'text', value: 'published' },
			{ type: 'if_close' },
		]);
	});
});

describe('tokenize — error cases', () => {
	it('throws on {{#each}} missing "as" keyword', () => {
		assert.throws(
			() => tokenize('{{#each items}}x{{/each}}'),
			(err: unknown) => err instanceof Error && err.message.includes('#each'),
		);
	});

	it('throws on empty partial name', () => {
		assert.throws(
			() => tokenize('{{> }}'),
			(err: unknown) => err instanceof Error && err.message.includes('partial'),
		);
	});

	it('throws on empty {{#if}} condition', () => {
		assert.throws(
			() => tokenize('{{#if }}yes{{/if}}'),
			(err: unknown) => err instanceof Error && err.message.includes('#if'),
		);
	});

	it('throws on invalid path characters', () => {
		assert.throws(
			() => tokenize('{{ 123invalid }}'),
			(err: unknown) => err instanceof Error,
		);
	});
});

describe('tokenize — mixed complex template', () => {
	it('tokenizes a realistic template fragment', () => {
		const tmpl =
			'<h1>{{ page.title }}</h1>\n{{#if page.draft}}<em>Draft</em>{{/if}}\n{{{ content }}}';
		const tokens = tokenize(tmpl);

		const types = tokens.map((t) => t.type);
		assert.deepEqual(types, ['text', 'var', 'text', 'if_open', 'text', 'if_close', 'text', 'raw']);
	});
});
