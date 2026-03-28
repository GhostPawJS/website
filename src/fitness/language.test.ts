import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { computeTextStats, countSyllables, getLanguageKit, sentenceLengths } from './language.ts';

describe('countSyllables', () => {
	it('counts basic vowel groups', () => {
		assert.equal(countSyllables('beautiful'), 3); // beau-ti-ful
		assert.equal(countSyllables('cat'), 1);
		assert.equal(countSyllables('create'), 1); // heuristic: trailing 'e' reduces to 1
	});
	it('returns minimum 1 for any word', () => {
		assert.equal(countSyllables('b'), 1);
		assert.equal(countSyllables('the'), 1);
	});
	it('handles silent trailing e', () => {
		assert.equal(countSyllables('make'), 1);
		assert.equal(countSyllables('time'), 1);
	});
	it('is case-insensitive', () => {
		assert.equal(countSyllables('BEAUTIFUL'), countSyllables('beautiful'));
	});
});

describe('computeTextStats', () => {
	const text =
		'The quick brown fox jumps over the lazy dog. ' +
		'This is a simple sentence. Pack my box with five dozen liquor jugs.';

	it('counts words', () => {
		const stats = computeTextStats(text);
		assert.ok(stats.words > 10);
	});

	it('counts sentences', () => {
		const stats = computeTextStats(text);
		assert.equal(stats.sentences, 3);
	});

	it('computes avgSentenceLength', () => {
		const stats = computeTextStats(text);
		assert.ok(stats.avgSentenceLength > 0);
	});

	it('returns zeros for empty text', () => {
		const stats = computeTextStats('');
		assert.equal(stats.words, 0);
		assert.equal(stats.sentences, 0);
	});
});

describe('getLanguageKit', () => {
	it('returns EN kit for "en"', () => {
		const kit = getLanguageKit('en');
		assert.ok(typeof kit.tokenize === 'function');
		assert.ok(typeof kit.textStats === 'function');
		assert.ok(typeof kit.readability === 'function');
	});

	it('returns DE kit for "de"', () => {
		const kit = getLanguageKit('de');
		assert.ok(typeof kit.tokenize === 'function');
	});

	it('defaults to EN for unknown language', () => {
		const kitUnknown = getLanguageKit('xx');
		const kitEn = getLanguageKit('en');
		// Same tokenizer behavior: both filter stopwords
		const tokens1 = kitUnknown.tokenize('the quick brown fox');
		const tokens2 = kitEn.tokenize('the quick brown fox');
		assert.deepEqual(tokens1, tokens2);
	});

	it('tokenize filters stopwords and short words', () => {
		const kit = getLanguageKit('en');
		const tokens = kit.tokenize('the is a quick brown fox');
		// 'the', 'is', 'a' are stopwords
		assert.ok(!tokens.includes('the'));
		assert.ok(!tokens.includes('is'));
		assert.ok(!tokens.includes('a'));
		assert.ok(tokens.includes('quick'));
		assert.ok(tokens.includes('brown'));
	});

	it('readability computes flesch score', () => {
		const kit = getLanguageKit('en');
		const text = 'The dog runs fast. The cat sleeps long. Birds fly high in the sky every day.';
		const stats = kit.textStats(text);
		const r = kit.readability(stats);
		assert.ok(typeof r.fleschReadingEase === 'number');
		assert.ok(typeof r.fleschKincaidGrade === 'number');
		assert.ok(typeof r.gunningFog === 'number');
	});
});

describe('sentenceLengths', () => {
	it('splits text into per-sentence word counts', () => {
		const lengths = sentenceLengths('The cat sat. The dog ran fast. Go!');
		assert.equal(lengths.length, 3);
	});

	it('returns correct word count per sentence', () => {
		const lengths = sentenceLengths('One. Two words. Three word sentence.');
		assert.equal(lengths[0], 1);
		assert.equal(lengths[1], 2);
		assert.equal(lengths[2], 3);
	});

	it('returns empty array for empty string', () => {
		assert.deepEqual(sentenceLengths(''), []);
	});

	it('handles multiple punctuation types as sentence boundaries', () => {
		const lengths = sentenceLengths('Stop! Are you sure? Yes I am.');
		assert.equal(lengths.length, 3);
	});

	it('filters out zero-length segments from consecutive punctuation', () => {
		// "Wait..." produces multiple punctuation chars but one sentence
		const lengths = sentenceLengths('Wait... Then go.');
		assert.ok(lengths.every((n) => n > 0));
	});

	it('returns one entry for text with no sentence-ending punctuation', () => {
		const lengths = sentenceLengths('This has no terminating punctuation');
		assert.equal(lengths.length, 1);
		assert.equal(lengths[0], 5);
	});
});

describe('getLanguageKit — aiSlopWords, hedgingPhrases, transitionWords', () => {
	it('EN kit has non-empty aiSlopWords set', () => {
		const kit = getLanguageKit('en');
		assert.ok(kit.aiSlopWords instanceof Set);
		assert.ok(kit.aiSlopWords.size > 0);
	});

	it('EN aiSlopWords includes known AI overuse words', () => {
		const kit = getLanguageKit('en');
		assert.ok(kit.aiSlopWords.has('delve'));
		assert.ok(kit.aiSlopWords.has('seamless'));
		assert.ok(kit.aiSlopWords.has('leverage'));
	});

	it('EN kit has non-empty hedgingPhrases array', () => {
		const kit = getLanguageKit('en');
		assert.ok(Array.isArray(kit.hedgingPhrases));
		assert.ok(kit.hedgingPhrases.length > 0);
	});

	it('EN hedgingPhrases includes known hedging patterns', () => {
		const kit = getLanguageKit('en');
		assert.ok(kit.hedgingPhrases.includes("it's important to note"));
		assert.ok(kit.hedgingPhrases.includes('needless to say'));
	});

	it('EN kit has non-empty transitionWords set', () => {
		const kit = getLanguageKit('en');
		assert.ok(kit.transitionWords instanceof Set);
		assert.ok(kit.transitionWords.size > 0);
	});

	it('EN transitionWords includes common transition starters', () => {
		const kit = getLanguageKit('en');
		assert.ok(kit.transitionWords.has('furthermore'));
		assert.ok(kit.transitionWords.has('however'));
		assert.ok(kit.transitionWords.has('therefore'));
	});

	it('DE kit has non-empty aiSlopWords set', () => {
		const kit = getLanguageKit('de');
		assert.ok(kit.aiSlopWords instanceof Set);
		assert.ok(kit.aiSlopWords.size > 0);
	});

	it('DE aiSlopWords includes known German AI overuse words', () => {
		const kit = getLanguageKit('de');
		assert.ok(kit.aiSlopWords.has('innovativ'));
		assert.ok(kit.aiSlopWords.has('nachhaltig'));
	});

	it('DE kit has non-empty hedgingPhrases', () => {
		const kit = getLanguageKit('de');
		assert.ok(kit.hedgingPhrases.length > 0);
	});

	it('DE kit has non-empty transitionWords', () => {
		const kit = getLanguageKit('de');
		assert.ok(kit.transitionWords.size > 0);
	});

	it('kit code matches the requested language', () => {
		assert.equal(getLanguageKit('en').code, 'en');
		assert.equal(getLanguageKit('de').code, 'de');
		assert.equal(getLanguageKit('fr').code, 'fr');
		assert.equal(getLanguageKit('es').code, 'es');
	});

	it('unknown language falls back to EN aiSlopWords', () => {
		const kitUnknown = getLanguageKit('xx');
		const kitEn = getLanguageKit('en');
		assert.deepEqual([...kitUnknown.aiSlopWords].sort(), [...kitEn.aiSlopWords].sort());
	});

	it('aiSlopWords and transitionWords are disjoint sets for EN', () => {
		const kit = getLanguageKit('en');
		for (const word of kit.aiSlopWords) {
			assert.ok(
				!kit.transitionWords.has(word),
				`"${word}" appears in both aiSlopWords and transitionWords`,
			);
		}
	});
});
