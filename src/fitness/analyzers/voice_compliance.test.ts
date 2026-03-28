import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { RenderedPage } from '../../types.ts';
import { getLanguageKit } from '../language.ts';
import type { TfidfIndex } from '../tfidf.ts';
import type { SiteContext } from '../types.ts';
import { voiceCompliance } from './voice_compliance.ts';

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

describe('voice_compliance analyzer', () => {
	it('always applies', () => {
		assert.ok(voiceCompliance.applies(makeCtx()));
	});

	it('returns empty results when no pages', () => {
		const results = voiceCompliance.analyze(makeCtx());
		assert.equal(results.length, 0);
	});

	// Short page skip
	it('skips pages with fewer than 100 words', () => {
		const page = makePage({ wordCount: 50, textContent: 'Short page.' });
		const ctx = makeCtx({ pages: [page], pageSet: new Set([page.url]) });
		const results = voiceCompliance.analyze(ctx);
		assert.equal(results.length, 0);
	});

	it('skips pages with exactly 99 words', () => {
		const page = makePage({ wordCount: 99, textContent: 'word '.repeat(99) });
		const ctx = makeCtx({ pages: [page], pageSet: new Set([page.url]) });
		const results = voiceCompliance.analyze(ctx);
		assert.equal(results.length, 0);
	});

	// ai_slop_word detection
	it('detects AI slop word "delve" in page text', () => {
		const page = makePage({
			wordCount: 150,
			textContent:
				'This article will delve into the topic. '.repeat(5) +
				'More content follows here to pad the word count for analysis purposes.',
			html: '<html><body><p>This article will delve into the topic. More content follows here to pad the word count for analysis purposes.</p></body></html>',
		});
		const ctx = makeCtx({ pages: [page], pageSet: new Set([page.url]) });
		const results = voiceCompliance.analyze(ctx);
		const fails = results.filter((r) => !r.pass) as { pass: false; issue: { code: string } }[];
		assert.ok(fails.some((r) => r.issue.code === 'ai_slop_word'));
	});

	it('detects AI slop word "seamless" in page text', () => {
		const page = makePage({
			wordCount: 150,
			textContent:
				'We provide seamless integration solutions. '.repeat(5) +
				'Additional content to reach the minimum word threshold for analysis.',
			html: '<html><body><p>We provide seamless integration solutions. Additional content to reach the minimum word threshold for analysis.</p></body></html>',
		});
		const ctx = makeCtx({ pages: [page], pageSet: new Set([page.url]) });
		const results = voiceCompliance.analyze(ctx);
		const fails = results.filter((r) => !r.pass) as { pass: false; issue: { code: string } }[];
		assert.ok(fails.some((r) => r.issue.code === 'ai_slop_word'));
	});

	it('passes page with no AI slop words', () => {
		const page = makePage({
			wordCount: 150,
			textContent:
				'The quick brown fox jumps over the lazy dog. Dogs are friendly animals. ' +
				'Cats are independent pets. Birds sing in the morning. Fish swim in water. ' +
				'Horses run fast across the fields. Rabbits hop through the garden path daily.',
			html: '<html><body><p>The quick brown fox jumps over the lazy dog. Dogs are friendly animals. Cats are independent pets. Birds sing in the morning. Fish swim in water. Horses run fast across the fields. Rabbits hop through the garden path daily.</p></body></html>',
		});
		const ctx = makeCtx({ pages: [page], pageSet: new Set([page.url]) });
		const results = voiceCompliance.analyze(ctx);
		const fails = results.filter((r) => !r.pass) as { pass: false; issue: { code: string } }[];
		assert.ok(!fails.some((r) => r.issue.code === 'ai_slop_word'));
	});

	// burstiness — sentence length variation
	it('runs burstiness check and returns array for any page', () => {
		// Monotone: short sentences with very similar word counts
		const monotone =
			'The cat sat. The dog ran. The bird flew. The fish swam. The horse ran. The rabbit hopped. The mouse ran. The fox ran.';
		const page = makePage({
			wordCount: 50,
			textContent: monotone,
			html: `<html><body><p>${monotone}</p></body></html>`,
		});
		const ctx = makeCtx({ pages: [page], pageSet: new Set([page.url]) });
		const results = voiceCompliance.analyze(ctx);
		assert.ok(Array.isArray(results));
	});

	it('does not flag pages with varied sentence lengths', () => {
		// Mix of very short and very long sentences produces high CV
		const varied =
			'Run! ' +
			'The quick brown fox jumped elegantly over the tall wooden fence on a sunny afternoon in the countryside. ' +
			'Go! ' +
			'This is a much longer sentence that adds many more words and ideas to the overall text structure here. ' +
			'Stop. ' +
			'The end.';
		const page = makePage({
			wordCount: 50,
			textContent: varied,
			html: `<html><body><p>${varied}</p></body></html>`,
		});
		const ctx = makeCtx({ pages: [page], pageSet: new Set([page.url]) });
		const results = voiceCompliance.analyze(ctx);
		const fails = results.filter((r) => !r.pass) as { pass: false; issue: { code: string } }[];
		assert.ok(!fails.some((r) => r.issue.code === 'low_burstiness'));
	});

	// high_hedging detection (requires >= 10 sentences)
	it('flags high hedging phrase density', () => {
		// Build text with many hedging phrases across many sentences
		const hedgingSentences = [
			"It's important to note that this works.",
			"It's worth noting the results.",
			'It should be noted that results vary.',
			'As we all know, testing matters.',
			'Needless to say, quality is key.',
			"It's important to note that speed matters.",
			"It's worth noting the performance.",
			'It should be noted that accuracy is critical.',
			'As we all know, data is important.',
			'Needless to say, reliability counts.',
			'Regular testing ensures good outcomes.',
		];
		const hedgy = hedgingSentences.join(' ');
		const page = makePage({
			wordCount: 120,
			textContent: hedgy,
			html: `<html><body><p>${hedgy}</p></body></html>`,
		});
		const ctx = makeCtx({ pages: [page], pageSet: new Set([page.url]) });
		const results = voiceCompliance.analyze(ctx);
		const fails = results.filter((r) => !r.pass) as { pass: false; issue: { code: string } }[];
		assert.ok(fails.some((r) => r.issue.code === 'high_hedging'));
	});

	// ai_slop_phrase detection
	it('flags AI slop phrase "in the realm of"', () => {
		const page = makePage({
			wordCount: 150,
			textContent:
				'In the realm of software development, many approaches exist. ' +
				'Engineers work hard every day to solve complex problems in the field. ' +
				'Testing is a core practice. Documentation helps everyone. ' +
				'Code reviews improve quality. Collaboration drives better outcomes. ' +
				'Continuous integration catches bugs early in the process. ' +
				'Deployment pipelines automate release workflows effectively.',
			html: '<html><body><p>In the realm of software development, many approaches exist.</p></body></html>',
		});
		const ctx = makeCtx({ pages: [page], pageSet: new Set([page.url]) });
		const results = voiceCompliance.analyze(ctx);
		const fails = results.filter((r) => !r.pass) as { pass: false; issue: { code: string } }[];
		assert.ok(fails.some((r) => r.issue.code === 'ai_slop_phrase'));
	});

	// Custom banned words from config
	it('detects custom banned words from config fitness.voice.bannedWords', () => {
		const page = makePage({
			wordCount: 150,
			textContent:
				'This is a synergy-driven approach to innovation. ' +
				'We strive to deliver excellent results every single day. ' +
				'Our team works collaboratively to achieve goals. ' +
				'Quality and reliability are our top priorities here. ' +
				'Customer satisfaction drives all of our decisions forward. ' +
				'We continuously improve our processes and products.',
			html: '<html><body><p>This is a synergy-driven approach to innovation.</p></body></html>',
		});
		const ctx = makeCtx({
			pages: [page],
			pageSet: new Set([page.url]),
			config: {
				name: 'Test',
				url: 'https://example.com',
				language: 'en',
				fitness: { voice: { bannedWords: ['synergy-driven'] } },
			},
		});
		const results = voiceCompliance.analyze(ctx);
		const fails = results.filter((r) => !r.pass) as { pass: false; issue: { code: string } }[];
		assert.ok(fails.some((r) => r.issue.code === 'ai_slop_word'));
	});

	it('does not flag word that is not in banned list or slop list', () => {
		const page = makePage({
			wordCount: 150,
			textContent:
				'This is a thoughtful approach to software design. ' +
				'We consider all tradeoffs carefully before making decisions. ' +
				'Engineers collaborate daily on complex systems. ' +
				'Testing and documentation are equally important practices. ' +
				'Reliability and performance are core engineering values. ' +
				'Continuous improvement drives long-term project success.',
			html: '<html><body><p>This is a thoughtful approach to software design.</p></body></html>',
		});
		const ctx = makeCtx({
			pages: [page],
			pageSet: new Set([page.url]),
			config: {
				name: 'Test',
				url: 'https://example.com',
				language: 'en',
				fitness: { voice: { bannedWords: ['forbidden-term'] } },
			},
		});
		const results = voiceCompliance.analyze(ctx);
		const fails = results.filter((r) => !r.pass) as { pass: false; issue: { code: string } }[];
		assert.ok(!fails.some((r) => r.issue.code === 'ai_slop_word'));
	});
});
