import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	buildTfidf,
	getCosineSimilarity,
	getDescSimilarity,
	getSharedTerms,
	getTitleSimilarity,
	levenshtein,
} from './tfidf.ts';

// Simple tokenizer for tests (no stopword filtering)
function tokenize(text: string): string[] {
	return text
		.toLowerCase()
		.split(/\s+/)
		.filter((w) => w.length >= 2);
}

describe('levenshtein', () => {
	it('returns 0 for identical strings', () => {
		assert.equal(levenshtein('hello', 'hello'), 0);
	});
	it('returns string length for empty string comparison', () => {
		assert.equal(levenshtein('abc', ''), 3);
		assert.equal(levenshtein('', 'abc'), 3);
	});
	it('computes substitution', () => {
		assert.equal(levenshtein('cat', 'bat'), 1);
	});
	it('computes insertion/deletion', () => {
		assert.equal(levenshtein('abc', 'ab'), 1);
		assert.equal(levenshtein('ab', 'abc'), 1);
	});
	it('handles longer strings', () => {
		assert.equal(levenshtein('kitten', 'sitting'), 3);
	});
});

describe('buildTfidf', () => {
	const docs = [
		{
			url: '/page-a',
			text: 'javascript typescript programming nodejs',
			title: 'JS Page',
			description: 'About JS',
		},
		{
			url: '/page-b',
			text: 'python machine learning data science pandas numpy',
			title: 'Python Page',
			description: 'About Python',
		},
		{
			url: '/page-c',
			text: 'javascript nodejs web development frontend backend',
			title: 'Node Page',
			description: 'Node development',
		},
	];

	const index = buildTfidf(docs, tokenize);

	it('creates vectors for all pages', () => {
		assert.ok(index.vectors.has('/page-a'));
		assert.ok(index.vectors.has('/page-b'));
		assert.ok(index.vectors.has('/page-c'));
	});

	it('vectors have raw scores', () => {
		const vec = index.vectors.get('/page-a');
		assert.ok(vec !== undefined);
		assert.ok(vec.raw.size > 0);
	});

	it('topTerms are non-empty', () => {
		const vec = index.vectors.get('/page-a');
		assert.ok(vec !== undefined);
		assert.ok(vec.topTerms.length > 0);
	});

	it('magnitude is positive', () => {
		const vec = index.vectors.get('/page-a');
		assert.ok(vec !== undefined);
		assert.ok(vec.magnitude > 0);
	});

	it('normalized vector sums to ~1 (unit vector)', () => {
		const vec = index.vectors.get('/page-a');
		assert.ok(vec !== undefined);
		// Sum of squares of normalized values should be ~1
		let sumSq = 0;
		for (const v of vec.normalized.values()) sumSq += v * v;
		assert.ok(Math.abs(sumSq - 1) < 1e-10);
	});

	it('computes pairwise similarities', () => {
		// a and c share javascript/nodejs → should be similar
		const ac = getCosineSimilarity(index, '/page-a', '/page-c');
		const ab = getCosineSimilarity(index, '/page-a', '/page-b');
		assert.ok(ac > 0, 'a and c share terms');
		assert.ok(ab >= 0, 'similarity is non-negative');
		// a,c more similar than a,b (different domains)
		assert.ok(ac > ab);
	});

	it('cosine similarity is symmetric', () => {
		const ac = getCosineSimilarity(index, '/page-a', '/page-c');
		const ca = getCosineSimilarity(index, '/page-c', '/page-a');
		assert.equal(ac, ca);
	});

	it('cosine similarity is in [0, 1]', () => {
		const ac = getCosineSimilarity(index, '/page-a', '/page-c');
		assert.ok(ac >= 0 && ac <= 1);
	});

	it('title similarities are computed', () => {
		// 'JS Page' vs 'Python Page' → some distance
		const ab = getTitleSimilarity(index, '/page-a', '/page-b');
		assert.ok(ab >= 0 && ab <= 1);
	});

	it('desc similarities are computed', () => {
		const ab = getDescSimilarity(index, '/page-a', '/page-b');
		assert.ok(ab >= 0 && ab <= 1);
	});

	it('getSharedTerms returns intersection', () => {
		const shared = getSharedTerms(index, '/page-a', '/page-c', 10);
		// javascript and/or nodejs should be shared
		assert.ok(shared.length > 0);
	});

	it('handles a single document gracefully', () => {
		const single = buildTfidf(
			[{ url: '/only', text: 'solo content here', title: 'Solo', description: '' }],
			tokenize,
		);
		assert.ok(single.vectors.has('/only'));
		// With 1 doc, IDF = log2(1/1) = 0, so all scores are 0 → vector may be empty
		// Just ensure it doesn't throw
	});

	it('handles empty text gracefully', () => {
		const withEmpty = buildTfidf(
			[
				{ url: '/empty', text: '', title: 'Empty', description: '' },
				{ url: '/full', text: 'content here for testing purposes', title: 'Full', description: '' },
			],
			tokenize,
		);
		const emptyVec = withEmpty.vectors.get('/empty');
		assert.ok(emptyVec !== undefined);
		assert.equal(emptyVec.raw.size, 0);
	});
});
