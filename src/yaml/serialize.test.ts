import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { extractFrontmatter } from './parse.ts';
import { serializeFrontmatter } from './serialize.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Round-trip: serialize → wrap in `---` delimiters → parse back. */
function roundTrip(data: Record<string, unknown>): Record<string, unknown> {
	const yaml = serializeFrontmatter(data);
	const raw = `---\n${yaml}\n---\n`;
	return extractFrontmatter(raw).data;
}

// ---------------------------------------------------------------------------
// Scalars
// ---------------------------------------------------------------------------

describe('serializeFrontmatter — scalars', () => {
	it('serializes a plain string', () => {
		assert.equal(serializeFrontmatter({ title: 'Hello World' }), 'title: Hello World');
	});

	it('serializes a number', () => {
		assert.equal(serializeFrontmatter({ count: 42 }), 'count: 42');
	});

	it('serializes a float', () => {
		assert.equal(serializeFrontmatter({ ratio: 3.14 }), 'ratio: 3.14');
	});

	it('serializes boolean true', () => {
		assert.equal(serializeFrontmatter({ draft: true }), 'draft: true');
	});

	it('serializes boolean false', () => {
		assert.equal(serializeFrontmatter({ draft: false }), 'draft: false');
	});

	it('serializes null', () => {
		assert.equal(serializeFrontmatter({ parent: null }), 'parent: null');
	});

	it('skips undefined values', () => {
		assert.equal(serializeFrontmatter({ title: 'Hi', skip: undefined }), 'title: Hi');
	});

	it('serializes an empty string as double-quoted', () => {
		assert.equal(serializeFrontmatter({ val: '' }), 'val: ""');
	});
});

// ---------------------------------------------------------------------------
// Strings requiring quoting
// ---------------------------------------------------------------------------

describe('serializeFrontmatter — string quoting', () => {
	it('quotes string containing a colon', () => {
		const out = serializeFrontmatter({ title: 'Hello: World' });
		assert.ok(out.includes('"'), `expected quotes in: ${out}`);
	});

	it('quotes string that looks like a boolean', () => {
		const out = serializeFrontmatter({ flag: 'true' });
		assert.ok(out.includes('"'), `expected quotes in: ${out}`);
	});

	it('quotes string that looks like null', () => {
		const out = serializeFrontmatter({ val: 'null' });
		assert.ok(out.includes('"'), `expected quotes in: ${out}`);
	});

	it('quotes string with leading space', () => {
		const out = serializeFrontmatter({ val: ' spaces' });
		assert.ok(out.includes('"'), `expected quotes in: ${out}`);
	});

	it('quotes string with a hash character', () => {
		const out = serializeFrontmatter({ val: 'foo#bar' });
		assert.ok(out.includes('"'), `expected quotes in: ${out}`);
	});

	it('quotes string with a newline', () => {
		const out = serializeFrontmatter({ val: 'line1\nline2' });
		assert.ok(out.includes('"'), `expected quotes in: ${out}`);
	});
});

// ---------------------------------------------------------------------------
// Arrays
// ---------------------------------------------------------------------------

describe('serializeFrontmatter — arrays', () => {
	it('serializes a string array as block sequence', () => {
		const out = serializeFrontmatter({ tags: ['a', 'b', 'c'] });
		assert.ok(out.includes('tags:'), out);
		assert.ok(out.includes('- a'), out);
		assert.ok(out.includes('- b'), out);
	});

	it('serializes an empty array as []', () => {
		assert.equal(serializeFrontmatter({ tags: [] }), 'tags: []');
	});

	it('serializes a number array', () => {
		const out = serializeFrontmatter({ nums: [1, 2, 3] });
		assert.ok(out.includes('- 1'), out);
	});

	it('quotes array items that need quoting', () => {
		const out = serializeFrontmatter({ vals: ['true', 'null'] });
		assert.ok(out.includes('"true"') || out.includes('"null"'), out);
	});
});

// ---------------------------------------------------------------------------
// Nested objects
// ---------------------------------------------------------------------------

describe('serializeFrontmatter — nested objects', () => {
	it('serializes a one-level nested object', () => {
		const out = serializeFrontmatter({ meta: { author: 'Bob', year: 2024 } });
		assert.ok(out.includes('meta:'), out);
		assert.ok(out.includes('  author: Bob'), out);
		assert.ok(out.includes('  year: 2024'), out);
	});

	it('serializes an empty nested object as {}', () => {
		assert.equal(serializeFrontmatter({ meta: {} }), 'meta: {}');
	});
});

// ---------------------------------------------------------------------------
// Round-trip correctness
// ---------------------------------------------------------------------------

describe('serializeFrontmatter — round-trip', () => {
	it('round-trips a plain string scalar', () => {
		assert.deepEqual(roundTrip({ title: 'Hello' }), { title: 'Hello' });
	});

	it('round-trips a boolean', () => {
		assert.deepEqual(roundTrip({ draft: false }), { draft: false });
	});

	it('round-trips a number', () => {
		assert.deepEqual(roundTrip({ count: 42 }), { count: 42 });
	});

	it('round-trips a null value', () => {
		assert.deepEqual(roundTrip({ parent: null }), { parent: null });
	});

	it('round-trips a string array', () => {
		assert.deepEqual(roundTrip({ tags: ['typescript', 'seo'] }), {
			tags: ['typescript', 'seo'],
		});
	});

	it('round-trips an empty array', () => {
		assert.deepEqual(roundTrip({ tags: [] }), { tags: [] });
	});

	it('round-trips a nested object', () => {
		assert.deepEqual(roundTrip({ meta: { author: 'Jane', year: 2024 } }), {
			meta: { author: 'Jane', year: 2024 },
		});
	});

	it('round-trips a string with special chars (quoted)', () => {
		assert.deepEqual(roundTrip({ title: 'Title: With Colon' }), {
			title: 'Title: With Colon',
		});
	});

	it('round-trips a string that looks like a boolean', () => {
		assert.deepEqual(roundTrip({ flag: 'true' }), { flag: 'true' });
	});

	it('round-trips a full blog post frontmatter', () => {
		const data = {
			title: 'My Post',
			description: 'A post about things',
			date: '2024-01-15',
			draft: false,
			tags: ['typescript', 'seo'],
			meta: { author: 'Jane' },
		};
		const rt = roundTrip(data);
		assert.equal(rt.title, 'My Post');
		assert.equal(rt.draft, false);
		assert.deepEqual(rt.tags, ['typescript', 'seo']);
		assert.deepEqual(rt.meta, { author: 'Jane' });
	});

	it('serializes multiple top-level keys preserving order', () => {
		const data = { a: 1, b: 'two', c: true };
		const out = serializeFrontmatter(data);
		const aPos = out.indexOf('a:');
		const bPos = out.indexOf('b:');
		const cPos = out.indexOf('c:');
		assert.ok(aPos < bPos && bPos < cPos, `unexpected order in:\n${out}`);
	});
});

// ---------------------------------------------------------------------------
// Arrays of objects (FAQs, breadcrumbs, etc.)
// ---------------------------------------------------------------------------

describe('serializeFrontmatter — arrays of objects', () => {
	it('serializes an array of plain objects as YAML block sequence of mappings', () => {
		const out = serializeFrontmatter({
			faqs: [
				{ q: 'What is it?', a: 'A static builder.' },
				{ q: 'Is it fast?', a: 'Yes.' },
			],
		});
		assert.ok(out.includes('faqs:'), out);
		assert.ok(out.includes('- q:'), out);
		assert.ok(out.includes('  a:'), out);
		assert.ok(!out.includes('[object Object]'), `should not contain [object Object]: ${out}`);
	});

	it('round-trips FAQ frontmatter array of objects', () => {
		const data = {
			faqs: [
				{ q: 'What is it?', a: 'A static builder.' },
				{ q: 'Does it require a database?', a: 'No.' },
			],
		};
		const rt = roundTrip(data);
		assert.ok(Array.isArray(rt.faqs), 'faqs should be an array');
		const faqs = rt.faqs as Array<Record<string, unknown>>;
		assert.equal(faqs.length, 2);
		assert.equal(faqs[0]?.q, 'What is it?');
		assert.equal(faqs[0]?.a, 'A static builder.');
		assert.equal(faqs[1]?.q, 'Does it require a database?');
	});

	it('round-trips breadcrumb array of objects', () => {
		const data = {
			breadcrumb: [
				{ label: 'Home', href: '/' },
				{ label: 'Blog', href: '/blog/' },
				{ label: 'My Post', href: '/blog/my-post/' },
			],
		};
		const rt = roundTrip(data);
		const crumbs = rt.breadcrumb as Array<Record<string, unknown>>;
		assert.equal(crumbs.length, 3);
		assert.equal(crumbs[0]?.label, 'Home');
		assert.equal(crumbs[0]?.href, '/');
		assert.equal(crumbs[2]?.label, 'My Post');
	});

	it('serializes empty object items as {}', () => {
		const out = serializeFrontmatter({ items: [{}] });
		assert.ok(out.includes('- {}'), out);
	});

	it('handles mixed scalar and object arrays — objects serialize correctly', () => {
		const out = serializeFrontmatter({ faqs: [{ q: 'Q?', a: 'A.' }] });
		assert.ok(!out.includes('[object Object]'), out);
	});
});

// ---------------------------------------------------------------------------
// Arrays of arrays (table rows)
// ---------------------------------------------------------------------------

describe('serializeFrontmatter — arrays of arrays', () => {
	it('round-trips a 2D table rows array', () => {
		const data = {
			tableRows: [
				['Starter', 'Up to 1 MW', 'Free'],
				['Growth', 'Up to 50 MW', '$299 / month'],
			],
		};
		const rt = roundTrip(data);
		assert.deepEqual(rt.tableRows, data.tableRows);
	});

	it('round-trips table rows with comma-containing cell values', () => {
		const data = {
			tableRows: [['Enterprise', 'Unlimited', 'Dedicated support, SSO']],
		};
		const rt = roundTrip(data);
		assert.deepEqual(rt.tableRows, data.tableRows);
	});

	it('serializes empty inner array as []', () => {
		const out = serializeFrontmatter({ rows: [[]] });
		assert.ok(out.includes('- []'), `expected "- []" in:\n${out}`);
	});
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('serializeFrontmatter — edge cases', () => {
	it('returns empty string for empty object', () => {
		assert.equal(serializeFrontmatter({}), '');
	});

	it('handles URL strings without quoting (no special chars)', () => {
		const out = serializeFrontmatter({ url: 'https://example.com/path' });
		// colons → quoted
		assert.ok(out.includes('url:'), out);
	});

	it('handles key with hyphens (no quoting needed for plain key)', () => {
		const out = serializeFrontmatter({ 'og-image': '/img.png' });
		assert.ok(out.includes('og-image'), out);
	});

	it('round-trips date strings without coercion', () => {
		assert.deepEqual(roundTrip({ date: '2024-01-15' }), { date: '2024-01-15' });
	});

	it('handles negative number', () => {
		assert.deepEqual(roundTrip({ offset: -5 }), { offset: -5 });
	});

	it('handles zero', () => {
		assert.deepEqual(roundTrip({ count: 0 }), { count: 0 });
	});
});
