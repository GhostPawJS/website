import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { extractFrontmatter, parse } from './parse.ts';

// ---------------------------------------------------------------------------
// Scalars
// ---------------------------------------------------------------------------

describe('parse — scalars', () => {
	it('parses an unquoted string', () => {
		assert.deepEqual(parse('key: hello world'), { key: 'hello world' });
	});

	it('parses a double-quoted string', () => {
		assert.deepEqual(parse('key: "hello world"'), { key: 'hello world' });
	});

	it('parses a single-quoted string', () => {
		assert.deepEqual(parse("key: 'hello world'"), { key: 'hello world' });
	});

	it('preserves escaped double-quote inside double-quoted string', () => {
		assert.deepEqual(parse('key: "say \\"hi\\""'), { key: 'say "hi"' });
	});

	it('handles double single-quote escape inside single-quoted string', () => {
		assert.deepEqual(parse("key: 'it''s fine'"), { key: "it's fine" });
	});

	it('parses a positive integer', () => {
		assert.deepEqual(parse('count: 42'), { count: 42 });
	});

	it('parses a negative integer', () => {
		assert.deepEqual(parse('offset: -7'), { offset: -7 });
	});

	it('parses a float', () => {
		assert.deepEqual(parse('ratio: 3.14'), { ratio: 3.14 });
	});

	it('parses a negative float', () => {
		assert.deepEqual(parse('temp: -0.5'), { temp: -0.5 });
	});

	it('parses hex integer', () => {
		assert.deepEqual(parse('color: 0xFF'), { color: 255 });
	});

	it('parses octal integer', () => {
		assert.deepEqual(parse('perms: 0o755'), { perms: 493 });
	});

	it('parses true', () => {
		assert.deepEqual(parse('flag: true'), { flag: true });
	});

	it('parses false', () => {
		assert.deepEqual(parse('flag: false'), { flag: false });
	});

	it('parses yes as true', () => {
		assert.deepEqual(parse('ok: yes'), { ok: true });
	});

	it('parses no as false', () => {
		assert.deepEqual(parse('ok: no'), { ok: false });
	});

	it('parses on as true', () => {
		assert.deepEqual(parse('active: on'), { active: true });
	});

	it('parses off as false', () => {
		assert.deepEqual(parse('active: off'), { active: false });
	});

	it('parses null', () => {
		assert.deepEqual(parse('key: null'), { key: null });
	});

	it('parses ~ as null', () => {
		assert.deepEqual(parse('key: ~'), { key: null });
	});

	it('parses empty value as null', () => {
		assert.deepEqual(parse('key:'), { key: null });
	});

	it('preserves string "true" when quoted', () => {
		assert.deepEqual(parse('flag: "true"'), { flag: 'true' });
	});

	it('preserves string "42" when quoted', () => {
		assert.deepEqual(parse('count: "42"'), { count: '42' });
	});

	it('preserves string "null" when quoted', () => {
		assert.deepEqual(parse('key: "null"'), { key: 'null' });
	});

	it('strips inline comments', () => {
		assert.deepEqual(parse('key: value # this is a comment'), { key: 'value' });
	});

	it('does not strip # inside a quoted value', () => {
		assert.deepEqual(parse('key: "value # not a comment"'), { key: 'value # not a comment' });
	});

	it('handles colon inside a double-quoted value', () => {
		assert.deepEqual(parse('title: "Hello: World"'), { title: 'Hello: World' });
	});

	it('handles colon inside a single-quoted value', () => {
		assert.deepEqual(parse("title: 'Hello: World'"), { title: 'Hello: World' });
	});

	it('returns empty object for empty input', () => {
		assert.deepEqual(parse(''), {});
	});

	it('returns empty object for whitespace-only input', () => {
		assert.deepEqual(parse('   \n  \n'), {});
	});

	it('ignores full-line comments', () => {
		assert.deepEqual(parse('# comment\nkey: value'), { key: 'value' });
	});
});

// ---------------------------------------------------------------------------
// Multiple keys
// ---------------------------------------------------------------------------

describe('parse — flat mappings', () => {
	it('parses multiple keys', () => {
		assert.deepEqual(parse('a: 1\nb: two\nc: true'), { a: 1, b: 'two', c: true });
	});

	it('handles blank lines between keys', () => {
		assert.deepEqual(parse('a: 1\n\nb: 2'), { a: 1, b: 2 });
	});

	it('handles mixed comment and blank lines', () => {
		assert.deepEqual(parse('# header\na: 1\n# mid\nb: 2'), { a: 1, b: 2 });
	});
});

// ---------------------------------------------------------------------------
// Nested mappings
// ---------------------------------------------------------------------------

describe('parse — nested mappings', () => {
	it('parses a single level of nesting', () => {
		const input = 'parent:\n  child: value';
		assert.deepEqual(parse(input), { parent: { child: 'value' } });
	});

	it('parses two levels of nesting', () => {
		const input = 'a:\n  b:\n    c: deep';
		assert.deepEqual(parse(input), { a: { b: { c: 'deep' } } });
	});

	it('parses sibling keys alongside a nested block', () => {
		const input = 'title: Hello\nmeta:\n  author: John\n  date: 2024\ntags: none';
		assert.deepEqual(parse(input), {
			title: 'Hello',
			meta: { author: 'John', date: 2024 },
			tags: 'none',
		});
	});

	it('handles sibling keys after nested block', () => {
		const input = 'meta:\n  author: Bob\nafter: yes';
		assert.deepEqual(parse(input), { meta: { author: 'Bob' }, after: true });
	});
});

// ---------------------------------------------------------------------------
// Block sequences
// ---------------------------------------------------------------------------

describe('parse — block sequences', () => {
	it('parses a simple string sequence', () => {
		const input = 'tags:\n  - one\n  - two\n  - three';
		assert.deepEqual(parse(input), { tags: ['one', 'two', 'three'] });
	});

	it('parses a sequence of integers', () => {
		const input = 'nums:\n  - 1\n  - 2\n  - 3';
		assert.deepEqual(parse(input), { nums: [1, 2, 3] });
	});

	it('parses a root-level sequence (rare but valid)', () => {
		// Root must be a mapping in the public API; this tests top-level key with seq
		const input = 'items:\n- alpha\n- beta';
		assert.deepEqual(parse(input), { items: ['alpha', 'beta'] });
	});

	it('handles sibling keys after a sequence', () => {
		const input = 'tags:\n  - a\n  - b\nafter: done';
		assert.deepEqual(parse(input), { tags: ['a', 'b'], after: 'done' });
	});
});

// ---------------------------------------------------------------------------
// Inline sequences
// ---------------------------------------------------------------------------

describe('parse — inline sequences', () => {
	it('parses an inline string sequence', () => {
		assert.deepEqual(parse('tags: [one, two, three]'), { tags: ['one', 'two', 'three'] });
	});

	it('parses an inline integer sequence', () => {
		assert.deepEqual(parse('nums: [1, 2, 3]'), { nums: [1, 2, 3] });
	});

	it('parses an empty inline sequence', () => {
		assert.deepEqual(parse('tags: []'), { tags: [] });
	});

	it('parses inline sequence with quoted items', () => {
		assert.deepEqual(parse('tags: ["foo bar", baz]'), { tags: ['foo bar', 'baz'] });
	});

	it('handles comma inside a quoted inline item', () => {
		assert.deepEqual(parse('k: ["a, b", c]'), { k: ['a, b', 'c'] });
	});

	it('parses nested inline sequences', () => {
		assert.deepEqual(parse('matrix: [[1, 2], [3, 4]]'), {
			matrix: [
				[1, 2],
				[3, 4],
			],
		});
	});
});

// ---------------------------------------------------------------------------
// Sequences of objects
// ---------------------------------------------------------------------------

describe('parse — sequences of objects', () => {
	it('parses a sequence of single-key objects', () => {
		const input = 'items:\n  - name: foo\n  - name: bar';
		assert.deepEqual(parse(input), { items: [{ name: 'foo' }, { name: 'bar' }] });
	});

	it('parses a sequence of multi-key objects', () => {
		const input = [
			'hours:',
			'  - day: Monday',
			'    open: "09:00"',
			'    close: "17:00"',
			'  - day: Tuesday',
			'    open: "10:00"',
			'    close: "18:00"',
		].join('\n');
		assert.deepEqual(parse(input), {
			hours: [
				{ day: 'Monday', open: '09:00', close: '17:00' },
				{ day: 'Tuesday', open: '10:00', close: '18:00' },
			],
		});
	});

	it('parses a sequence of objects with nested sequence', () => {
		const input = ['items:', '  - title: foo', '    tags:', '      - a', '      - b'].join('\n');
		assert.deepEqual(parse(input), {
			items: [{ title: 'foo', tags: ['a', 'b'] }],
		});
	});

	it('parses root-level sequence of objects', () => {
		const input = '- name: foo\n  val: 1\n- name: bar\n  val: 2';
		// Root must be a mapping; but the caller provides a root with a seq key:
		const wrapped = `list:\n${input.replace(/^/gm, '  ')}`;
		assert.deepEqual(parse(wrapped), {
			list: [
				{ name: 'foo', val: 1 },
				{ name: 'bar', val: 2 },
			],
		});
	});
});

// ---------------------------------------------------------------------------
// Literal block scalars (|)
// ---------------------------------------------------------------------------

describe('parse — literal block scalar |', () => {
	it('parses a basic literal block', () => {
		const input = 'desc: |\n  Line one\n  Line two';
		const result = parse(input);
		assert.equal(result.desc, 'Line one\nLine two\n');
	});

	it('preserves extra blank lines inside literal block', () => {
		const input = 'desc: |\n  Line one\n\n  Line three';
		const result = parse(input);
		assert.equal(result.desc, 'Line one\n\nLine three\n');
	});

	it('strips trailing newline with |-', () => {
		const input = 'desc: |-\n  Hello\n  World';
		const result = parse(input);
		assert.equal(result.desc, 'Hello\nWorld');
	});

	it('parses literal block followed by sibling key', () => {
		const input = 'body: |\n  content\nafter: done';
		const result = parse(input);
		assert.equal(result.body, 'content\n');
		assert.equal(result.after, 'done');
	});

	it('preserves extra indentation inside literal block', () => {
		const input = 'code: |\n  function foo() {\n    return 42;\n  }';
		const result = parse(input);
		assert.equal(result.code, 'function foo() {\n  return 42;\n}\n');
	});
});

// ---------------------------------------------------------------------------
// Folded block scalars (>)
// ---------------------------------------------------------------------------

describe('parse — folded block scalar >', () => {
	it('folds lines into a single paragraph', () => {
		const input = 'desc: >\n  This is a long\n  description.';
		const result = parse(input);
		assert.equal(result.desc, 'This is a long description.\n');
	});

	it('strips trailing newline with >-', () => {
		const input = 'desc: >-\n  Hello\n  World';
		const result = parse(input);
		assert.equal(result.desc, 'Hello World');
	});

	it('blank line creates paragraph break in folded block', () => {
		const input = 'desc: >\n  Para one\n  continues.\n\n  Para two.';
		const result = parse(input);
		// blank line → paragraph break
		assert.ok(
			(result.desc as string).includes('\n\n') || (result.desc as string).includes('\nPara two'),
		);
	});

	it('parses folded block followed by sibling key', () => {
		const input = 'body: >\n  content\nafter: done';
		const result = parse(input);
		assert.equal(result.after, 'done');
	});
});

// ---------------------------------------------------------------------------
// Real-world frontmatter patterns
// ---------------------------------------------------------------------------

describe('parse — real-world patterns', () => {
	it('parses a typical blog post frontmatter', () => {
		const input = [
			'title: My First Post',
			'description: A brief intro',
			'date: 2024-01-15',
			'author: Jane Doe',
			'layout: post.html',
			'tags:',
			'  - typescript',
			'  - seo',
			'draft: false',
		].join('\n');

		const result = parse(input);
		assert.equal(result.title, 'My First Post');
		assert.equal(result.draft, false);
		assert.deepEqual(result.tags, ['typescript', 'seo']);
	});

	it('parses socials as nested mapping', () => {
		const input = 'socials:\n  twitter: "@foo"\n  github: foobar';
		assert.deepEqual(parse(input), {
			socials: { twitter: '@foo', github: 'foobar' },
		});
	});

	it('parses date strings without coercion', () => {
		// Dates like 2024-01-15 must remain strings, not Date objects
		assert.deepEqual(parse('date: 2024-01-15'), { date: '2024-01-15' });
	});
});

// ---------------------------------------------------------------------------
// extractFrontmatter
// ---------------------------------------------------------------------------

describe('extractFrontmatter', () => {
	it('extracts frontmatter and body from a standard markdown file', () => {
		const content = '---\ntitle: Hello\n---\n# Body\n\nContent here.';
		const result = extractFrontmatter(content);
		assert.deepEqual(result.data, { title: 'Hello' });
		assert.equal(result.body, '# Body\n\nContent here.');
	});

	it('returns empty data and full string when no frontmatter present', () => {
		const content = '# Just a heading\n\nSome text.';
		const result = extractFrontmatter(content);
		assert.deepEqual(result.data, {});
		assert.equal(result.body, content);
	});

	it('handles a file with frontmatter but no body', () => {
		const content = '---\ntitle: Only Meta\n---\n';
		const result = extractFrontmatter(content);
		assert.deepEqual(result.data, { title: 'Only Meta' });
		assert.equal(result.body, '');
	});

	it('handles empty frontmatter block', () => {
		const content = '---\n---\n# Body';
		const result = extractFrontmatter(content);
		assert.deepEqual(result.data, {});
		assert.equal(result.body, '# Body');
	});

	it('extracts complex frontmatter with arrays and nested objects', () => {
		const content = [
			'---',
			'title: Complex',
			'tags:',
			'  - one',
			'  - two',
			'meta:',
			'  author: Bob',
			'---',
			'Body text.',
		].join('\n');
		const result = extractFrontmatter(content);
		assert.equal(result.data.title, 'Complex');
		assert.deepEqual(result.data.tags, ['one', 'two']);
		assert.deepEqual(result.data.meta, { author: 'Bob' });
		assert.equal(result.body, 'Body text.');
	});

	it('does not consume content when --- appears in the body', () => {
		const content = '---\ntitle: Test\n---\nSome text\n---\nMore text';
		const result = extractFrontmatter(content);
		assert.equal(result.data.title, 'Test');
		assert.ok(result.body.includes('Some text'));
	});
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('parse — edge cases', () => {
	it('handles keys with hyphens', () => {
		assert.deepEqual(parse('og-image: /img.jpg'), { 'og-image': '/img.jpg' });
	});

	it('handles keys with underscores', () => {
		assert.deepEqual(parse('og_image: /img.jpg'), { og_image: '/img.jpg' });
	});

	it('handles URL values without quoting', () => {
		assert.deepEqual(parse('url: https://example.com'), { url: 'https://example.com' });
	});

	it('handles value with colon in an unquoted URL', () => {
		assert.deepEqual(parse('url: https://example.com/path'), { url: 'https://example.com/path' });
	});

	it('handles tab indentation by expanding to 2 spaces', () => {
		const input = 'parent:\n\tchild: value';
		assert.deepEqual(parse(input), { parent: { child: 'value' } });
	});

	it('handles deeply nested structure', () => {
		const input = 'a:\n  b:\n    c:\n      d: deep';
		assert.deepEqual(parse(input), { a: { b: { c: { d: 'deep' } } } });
	});

	it('sequence items alongside regular keys', () => {
		const input = 'title: T\nlist:\n  - x\n  - y\nend: ok';
		assert.deepEqual(parse(input), { title: 'T', list: ['x', 'y'], end: 'ok' });
	});

	it('handles unicode in strings', () => {
		assert.deepEqual(parse('name: Ünïcödé'), { name: 'Ünïcödé' });
	});

	it('handles multiline description in > without body confusion', () => {
		const input = [
			'title: My Page',
			'description: >',
			'  Short and sweet',
			'  description here.',
			'layout: page.html',
		].join('\n');
		const result = parse(input);
		assert.equal(result.title, 'My Page');
		assert.equal(result.layout, 'page.html');
		assert.ok(typeof result.description === 'string');
	});
});

// ---------------------------------------------------------------------------
// Error cases
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Bug-regression tests
// ---------------------------------------------------------------------------

describe('parse — CRLF line endings', () => {
	it('handles CRLF in a flat mapping', () => {
		assert.deepEqual(parse('key: value\r\nother: 42'), { key: 'value', other: 42 });
	});

	it('handles CRLF in nested blocks', () => {
		assert.deepEqual(parse('parent:\r\n  child: val'), { parent: { child: 'val' } });
	});
});

describe('extractFrontmatter — CRLF line endings', () => {
	it('extracts frontmatter from a CRLF file', () => {
		const content = '---\r\ntitle: Hello\r\n---\r\n# Body';
		const result = extractFrontmatter(content);
		assert.equal(result.data.title, 'Hello');
		assert.equal(result.body, '# Body');
	});
});

describe('parse — # inside block scalars is literal, not a comment', () => {
	it('preserves markdown headings in a literal block', () => {
		const input = 'body: |\n  # Heading\n  Content';
		const result = parse(input);
		assert.equal(result.body, '# Heading\nContent\n');
	});

	it('preserves code comments in a literal block', () => {
		const input = 'code: |\n  // comment\n  x = 1 # python comment';
		const result = parse(input);
		assert.equal(result.code, '// comment\nx = 1 # python comment\n');
	});

	it('preserves # lines in a folded block', () => {
		const input = 'desc: >\n  ## Section\n  paragraph.';
		const result = parse(input);
		assert.ok((result.desc as string).includes('##'));
	});
});

describe('parse — unescapeDoubleQuoted single-pass correctness', () => {
	it('preserves literal backslash-n as backslash+n', () => {
		// \\n in YAML double-quoted = literal backslash followed by n
		assert.equal(parse('k: "path\\\\nfile"').k, 'path\\nfile');
	});

	it('converts escape sequence \\n to actual newline', () => {
		assert.equal(parse('k: "line1\\nline2"').k, 'line1\nline2');
	});

	it('handles unicode escape \\uXXXX', () => {
		assert.equal(parse('k: "caf\\u00e9"').k, 'café');
	});

	it('handles double-backslash correctly', () => {
		assert.equal(parse('k: "a\\\\b"').k, 'a\\b');
	});
});

describe('parse — applyChomping keep preserves trailing blank lines', () => {
	it('|+ preserves trailing newlines', () => {
		const input = 'desc: |+\n  Content\n\n';
		const result = parse(input);
		// keep chomping: content + trailing newlines
		assert.ok((result.desc as string).startsWith('Content'));
		assert.ok((result.desc as string).endsWith('\n\n'));
	});

	it('|- strips all trailing newlines', () => {
		const input = 'desc: |-\n  Content\n\n';
		const result = parse(input);
		assert.equal(result.desc, 'Content');
	});
});

describe('parse — error cases', () => {
	it('throws on a top-level line with no colon separator', () => {
		// A root-level line that is not a sequence item and has no `: ` is invalid
		assert.throws(
			() => parse('just a plain line with no colon'),
			(err: unknown) => err instanceof Error && err.message.includes('YAML'),
		);
	});

	it('throws on an empty key (bare colon)', () => {
		assert.throws(
			() => parse(': value'),
			(err: unknown) => err instanceof Error && err.message.includes('YAML'),
		);
	});
});
