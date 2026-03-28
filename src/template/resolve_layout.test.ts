import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseLayoutDeclaration, resolveLayoutChain } from './resolve_layout.ts';

// ---------------------------------------------------------------------------
// parseLayoutDeclaration
// ---------------------------------------------------------------------------

describe('parseLayoutDeclaration — detection', () => {
	it('detects a layout comment at the top of a file', () => {
		const src = '<!-- layout: base.html -->\n<main>{{{ content }}}</main>';
		const { parent } = parseLayoutDeclaration(src);
		assert.equal(parent, 'base.html');
	});

	it('detects a layout comment in the middle of a file', () => {
		const src = '<nav></nav>\n<!-- layout: base.html -->\n<main></main>';
		const { parent } = parseLayoutDeclaration(src);
		assert.equal(parent, 'base.html');
	});

	it('returns null when no layout comment is present', () => {
		const src = '<html><body>{{{ content }}}</body></html>';
		const { parent } = parseLayoutDeclaration(src);
		assert.equal(parent, null);
	});

	it('handles leading whitespace before the comment', () => {
		const src = '  <!-- layout: wrapper.html -->\n<p>hi</p>';
		const { parent } = parseLayoutDeclaration(src);
		assert.equal(parent, 'wrapper.html');
	});

	it('handles extra spaces inside the comment', () => {
		const src = '<!--  layout:  base.html  -->\n<p>hi</p>';
		const { parent } = parseLayoutDeclaration(src);
		assert.equal(parent, 'base.html');
	});

	it('handles tab indentation before the comment', () => {
		const src = '\t<!-- layout: base.html -->\n<p>hi</p>';
		const { parent } = parseLayoutDeclaration(src);
		assert.equal(parent, 'base.html');
	});

	it('does not match a layout comment embedded in prose', () => {
		// Inline HTML comment mid-sentence should not count if it has surrounding text
		const src = '<p>see <!-- layout: base.html --> here</p>';
		// The regex requires the comment to occupy its own line (^ anchor with multiline)
		const { parent } = parseLayoutDeclaration(src);
		assert.equal(parent, null);
	});
});

describe('parseLayoutDeclaration — stripping', () => {
	it('strips the comment from the returned source', () => {
		const src = '<!-- layout: base.html -->\n<main>{{{ content }}}</main>';
		const { source } = parseLayoutDeclaration(src);
		assert.ok(!source.includes('<!-- layout:'));
		assert.ok(source.includes('<main>'));
	});

	it('source is unchanged when no comment is present', () => {
		const src = '<html>{{{ content }}}</html>';
		const { source } = parseLayoutDeclaration(src);
		assert.equal(source, src);
	});

	it('strips exactly the comment line, not surrounding content', () => {
		const src = '<nav>nav</nav>\n<!-- layout: base.html -->\n<footer>foot</footer>';
		const { source } = parseLayoutDeclaration(src);
		assert.equal(source, '<nav>nav</nav>\n<footer>foot</footer>');
	});

	it('does not leave a blank line when comment is the only line', () => {
		const src = '<!-- layout: base.html -->\n';
		const { source } = parseLayoutDeclaration(src);
		assert.equal(source, '');
	});

	it('preserves content before and after a mid-file comment', () => {
		const src = 'A\n<!-- layout: b.html -->\nC';
		const { source } = parseLayoutDeclaration(src);
		assert.equal(source, 'A\nC');
	});
});

// ---------------------------------------------------------------------------
// resolveLayoutChain
// ---------------------------------------------------------------------------

describe('resolveLayoutChain — basic chains', () => {
	const templates = new Map([
		['base.html', '<html>{{{ content }}}</html>'],
		['page.html', '<!-- layout: base.html -->\n<main>{{{ content }}}</main>'],
		['post.html', '<!-- layout: page.html -->\n<article>{{{ content }}}</article>'],
	]);
	const get = (name: string) => templates.get(name) ?? null;

	it('returns single-element chain for a root layout', () => {
		assert.deepEqual(resolveLayoutChain('base.html', get), ['base.html']);
	});

	it('returns two-element chain for one level of nesting', () => {
		assert.deepEqual(resolveLayoutChain('page.html', get), ['base.html', 'page.html']);
	});

	it('returns three-element chain for two levels of nesting', () => {
		assert.deepEqual(resolveLayoutChain('post.html', get), ['base.html', 'page.html', 'post.html']);
	});

	it('chain is ordered outermost-first', () => {
		const chain = resolveLayoutChain('post.html', get);
		assert.equal(chain[0], 'base.html'); // root is first
		assert.equal(chain[chain.length - 1], 'post.html'); // leaf is last
	});
});

describe('resolveLayoutChain — error cases', () => {
	it('throws not_found when the start layout does not exist', () => {
		assert.throws(
			() => resolveLayoutChain('missing.html', () => null),
			(err: unknown) => err instanceof Error && err.message.includes('missing.html'),
		);
	});

	it('throws not_found when a parent layout in the chain does not exist', () => {
		const get = (name: string) =>
			name === 'page.html' ? '<!-- layout: ghost.html -->\n<p></p>' : null;
		assert.throws(
			() => resolveLayoutChain('page.html', get),
			(err: unknown) => err instanceof Error && err.message.includes('ghost.html'),
		);
	});

	it('throws conflict on a direct circular reference', () => {
		const get = (name: string) => `<!-- layout: ${name} -->\n<p></p>`;
		assert.throws(
			() => resolveLayoutChain('loop.html', get),
			(err: unknown) => err instanceof Error && err.message.toLowerCase().includes('circular'),
		);
	});

	it('throws conflict on an indirect circular reference', () => {
		const templates = new Map([
			['a.html', '<!-- layout: b.html -->\nA'],
			['b.html', '<!-- layout: c.html -->\nB'],
			['c.html', '<!-- layout: a.html -->\nC'],
		]);
		assert.throws(
			() => resolveLayoutChain('a.html', (n) => templates.get(n) ?? null),
			(err: unknown) => err instanceof Error && err.message.toLowerCase().includes('circular'),
		);
	});
});

describe('resolveLayoutChain — integration with parseLayoutDeclaration', () => {
	it('stripped sources render correctly via the chain', () => {
		// Simulate what render_page.ts will do:
		// 1. render markdown → html
		// 2. walk chain innermost→outermost, slotting {{{ content }}}
		const templates = new Map([
			['base.html', '<html>{{{ content }}}</html>'],
			['page.html', '<!-- layout: base.html -->\n<main>{{{ content }}}</main>'],
		]);
		const get = (name: string) => templates.get(name) ?? null;

		const chain = resolveLayoutChain('page.html', get);
		assert.deepEqual(chain, ['base.html', 'page.html']);

		// Verify that stripped sources have no layout comment
		for (const name of chain) {
			const raw = get(name);
			if (!raw) continue;
			const { source } = parseLayoutDeclaration(raw);
			assert.ok(
				!source.includes('<!-- layout:'),
				`${name} still contains layout comment after stripping`,
			);
		}
	});
});
