// ---------------------------------------------------------------------------
// Analyzer: voice_compliance — Voice quality and AI-slop detection
//
// Detects AI-generated text patterns: overused filler words, hedging phrases,
// monotone sentence structure, and excessive transition words.
// ---------------------------------------------------------------------------

import { stripTags } from '../html_parser.ts';
import { sentenceLengths } from '../language.ts';
import type { Analyzer, CheckResult, SiteContext } from '../types.ts';
import { fail, pass } from '../types.ts';

const DIMENSION = 'voice_compliance';

const MIN_WORDS = 100;

export const voiceCompliance: Analyzer = {
	id: 'voice_compliance',
	dimension: DIMENSION,
	weight: 12,
	applies: () => true,

	analyze(ctx: SiteContext): CheckResult[] {
		const results: CheckResult[] = [];

		const voiceConfig = ctx.config.fitness?.voice;
		const bannedWords: string[] = voiceConfig?.bannedWords ?? [];
		const bannedPhrases: string[] = voiceConfig?.bannedPhrases ?? [];
		const burstinessMin: number = voiceConfig?.burstinessMin ?? 0.3;
		const hedgingMaxPercent: number = voiceConfig?.hedgingMaxPercent ?? 2;
		const transitionMaxPercent: number = voiceConfig?.transitionMaxPercent ?? 3;

		for (const page of ctx.pages) {
			const { url, wordCount, html } = page;

			// Skip short pages
			if (wordCount < MIN_WORDS) continue;

			// Use plain text for analysis
			const text = stripTags(html);

			// 1. ai_slop_words — language kit words + config banned words
			const allSlopWords = [...ctx.language.aiSlopWords, ...bannedWords];
			for (const word of allSlopWords) {
				const wordRe = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
				if (wordRe.test(page.textContent)) {
					results.push(
						fail({
							severity: 'warning',
							dimension: DIMENSION,
							code: 'ai_slop_word',
							message: `AI slop word "${word}" detected — replace with more precise language.`,
							page: url,
							element: word,
							fix: { file: page.file, action: 'update_content', value: word },
						}),
					);
				} else {
					results.push(pass);
				}
			}

			// 2. ai_slop_phrases — language kit hedging + config banned phrases
			const allSlopPhrases = [...ctx.language.hedgingPhrases, ...bannedPhrases];
			for (const phrase of allSlopPhrases) {
				const phraseRe = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
				if (phraseRe.test(page.textContent)) {
					results.push(
						fail({
							severity: 'warning',
							dimension: DIMENSION,
							code: 'ai_slop_phrase',
							message: `AI slop phrase "${phrase}" detected — replace with more direct language.`,
							page: url,
							element: phrase,
							fix: { file: page.file, action: 'update_content', value: phrase },
						}),
					);
				} else {
					results.push(pass);
				}
			}

			// Compute sentence lengths for checks 3–5
			const lengths = sentenceLengths(text);
			const totalSentences = lengths.length;

			// 3. burstiness — sentence length variation (>= 5 sentences)
			if (totalSentences >= 5) {
				const mean = lengths.reduce((s, l) => s + l, 0) / totalSentences;
				const stddev = Math.sqrt(lengths.reduce((s, l) => s + (l - mean) ** 2, 0) / totalSentences);
				const cv = mean > 0 ? stddev / mean : 0;
				if (cv < burstinessMin) {
					results.push(
						fail({
							severity: 'warning',
							dimension: DIMENSION,
							code: 'low_burstiness',
							message: `Sentence length variation is low (CV: ${cv.toFixed(2)}) — AI-generated text often has monotone sentence lengths. Target CV ≥ ${burstinessMin}.`,
							page: url,
							current: cv.toFixed(2),
							expected: `≥ ${burstinessMin}`,
						}),
					);
				} else {
					results.push(pass);
				}
			}

			// 4. hedging_density (>= 10 sentences)
			if (totalSentences >= 10) {
				const hedgingPhrases = [...ctx.language.hedgingPhrases, ...bannedPhrases];
				let hedgingCount = 0;
				for (const phrase of hedgingPhrases) {
					const re = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
					const matches = page.textContent.match(re);
					if (matches) hedgingCount += matches.length;
				}
				const hedgingPercent = (hedgingCount / totalSentences) * 100;
				if (hedgingPercent > hedgingMaxPercent) {
					results.push(
						fail({
							severity: 'warning',
							dimension: DIMENSION,
							code: 'high_hedging',
							message: `Hedging phrase density is ${hedgingPercent.toFixed(1)}% of sentences (max ${hedgingMaxPercent}%) — reduce uncertain language.`,
							page: url,
							current: `${hedgingPercent.toFixed(1)}%`,
							expected: `≤ ${hedgingMaxPercent}%`,
						}),
					);
				} else {
					results.push(pass);
				}
			}

			// 5. transition_overuse (>= 10 sentences)
			if (totalSentences >= 10) {
				// Split into sentences and check each first word
				const sentences = text
					.split(/[.!?]+/)
					.map((s) => s.trim())
					.filter(Boolean);
				let transitionCount = 0;
				for (const sentence of sentences) {
					const firstWord = sentence.split(/\s+/)[0];
					if (firstWord && ctx.language.transitionWords.has(firstWord.toLowerCase())) {
						transitionCount++;
					}
				}
				const transitionPercent = (transitionCount / totalSentences) * 100;
				if (transitionPercent > transitionMaxPercent) {
					results.push(
						fail({
							severity: 'info',
							dimension: DIMENSION,
							code: 'transition_overuse',
							message: `${transitionPercent.toFixed(1)}% of sentences start with transition words (max ${transitionMaxPercent}%) — vary sentence openers for more natural flow.`,
							page: url,
							current: `${transitionPercent.toFixed(1)}%`,
							expected: `≤ ${transitionMaxPercent}%`,
						}),
					);
				} else {
					results.push(pass);
				}
			}
		}

		return results;
	},
};
