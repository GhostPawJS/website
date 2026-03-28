// ---------------------------------------------------------------------------
// Language kit: tokenization, stopwords, readability formulas.
// Pure functions, zero I/O, no external deps.
// ---------------------------------------------------------------------------

import type { ReadabilityScores } from '../types.ts';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface TextStats {
	words: number;
	sentences: number;
	syllables: number;
	complexWords: number; // words with 3+ syllables
	avgSentenceLength: number;
	avgSyllablesPerWord: number;
}

export interface LanguageKit {
	code: string;
	stopwords: Set<string>;
	aiSlopWords: Set<string>;
	hedgingPhrases: readonly string[];
	transitionWords: Set<string>;
	tokenize: (text: string) => string[];
	textStats: (text: string) => TextStats;
	readability: (stats: TextStats) => ReadabilityScores;
}

// ---------------------------------------------------------------------------
// Stopword lists
// ---------------------------------------------------------------------------

const EN_STOPWORDS = new Set(
	`a about above after again against all am an and any are aren't as at be because been
before being below between both but by can't cannot could couldn't did didn't do does doesn't
doing don't down during each few for from further get got had hadn't has hasn't have haven't
having he he'd he'll he's her here here's hers herself him himself his how how's i i'd i'll
i'm i've if in into is isn't it it's its itself let's me more most mustn't my myself no nor
not of off on once only or other ought our ours ourselves out over own same shan't she she'd
she'll she's should shouldn't so some such than that that's the their theirs them themselves
then there there's these they they'd they'll they're they've this those through to too under
until up very was wasn't we we'd we'll we're we've were weren't what what's when when's where
where's which while who who's whom why why's will with won't would wouldn't you you'd you'll
you're you've your yours yourself yourselves`
		.trim()
		.split(/\s+/),
);

const DE_STOPWORDS = new Set(
	`aber als am an auch auf aus bei bin bis da damit das dass dem den der des die dies dieser
dieses du durch ein eine einem einen einer eines er es für gegen hatte haben hat her hier ihm
ihn ihnen ihr im in ist ja kann kein keine kommt machen man mehr mein mit nach nicht noch nun
nur ob oder ohne sein seinem seinen seiner sich sie sind so soll über um und uns unter vom von
vor war was wenn werden wie will wir wird wo zu zum zur zwischen`
		.trim()
		.split(/\s+/),
);

const FR_STOPWORDS = new Set(
	`a au aux avec ce ces cet cette dans de des du elle elles en et eu eux il ils je la le les
leur leurs lui ma me mes moi mon même ni nos notre nous on ou où par pas pour qu que qui sa se
ses si soi son sur ta te tes toi ton tout toute toutes tous tu un une vos votre vous y à été
être`
		.trim()
		.split(/\s+/),
);

const ES_STOPWORDS = new Set(
	`a al algo algunas algunos ante antes como con contra cual cuando de del desde donde durante
e el ella ellas ellos en entre era eres es esa esas ese esos esta estas este esto estos fue
fui había han has hasta hay he hemos hizo la las le les lo los más me mi mis muy nada ni no
nos nuestra nuestro o os para pero poco por que qué quien quienes se si sin sobre su sus tal
también tanto te tenía tu tus un una unas uno unos vosotras vosotros vuestra vuestro y ya yo`
		.trim()
		.split(/\s+/),
);

// ---------------------------------------------------------------------------
// Syllable counter (English heuristic, ~90% accuracy)
// ---------------------------------------------------------------------------

/**
 * Count syllables in a single English word.
 * Uses a vowel-group heuristic with silent-e correction.
 */
export function countSyllables(word: string): number {
	const w = word.toLowerCase().replace(/[^a-z]/g, '');
	if (w.length === 0) return 0;
	if (w.length <= 3) return 1;

	let count = 0;
	let prevVowel = false;
	for (let i = 0; i < w.length; i++) {
		const ch = w[i] ?? '';
		const isVowel = 'aeiouy'.includes(ch);
		if (isVowel && !prevVowel) count++;
		prevVowel = isVowel;
	}

	// Subtract silent trailing 'e'
	if (w.endsWith('e') && !w.endsWith('le') && count > 1) count--;
	// 'es' and 'ed' at end often silent
	if ((w.endsWith('es') || w.endsWith('ed')) && count > 1) count--;

	return Math.max(1, count);
}

// ---------------------------------------------------------------------------
// Sentence and word counting
// ---------------------------------------------------------------------------

/** Count approximate sentences in plain text (split on ., !, ?). */
export function countSentences(text: string): number {
	const stripped = text.trim();
	if (!stripped) return 0;
	const matches = stripped.match(/[.!?]+/g);
	return Math.max(1, matches ? matches.length : 1);
}

/** Split plain text into word tokens (lowercase, letters+digits only). */
function splitWords(text: string): string[] {
	return text.toLowerCase().match(/\b[a-z0-9]+\b/g) ?? [];
}

// ---------------------------------------------------------------------------
// TextStats
// ---------------------------------------------------------------------------

export function computeTextStats(text: string): TextStats {
	const words = splitWords(text);
	const wordCount = words.length;
	const sentences = countSentences(text);

	if (wordCount === 0) {
		return {
			words: 0,
			sentences: 0,
			syllables: 0,
			complexWords: 0,
			avgSentenceLength: 0,
			avgSyllablesPerWord: 0,
		};
	}

	let totalSyllables = 0;
	let complexWords = 0;
	for (const w of words) {
		const s = countSyllables(w);
		totalSyllables += s;
		if (s >= 3) complexWords++;
	}

	return {
		words: wordCount,
		sentences,
		syllables: totalSyllables,
		complexWords,
		avgSentenceLength: wordCount / sentences,
		avgSyllablesPerWord: totalSyllables / wordCount,
	};
}

// ---------------------------------------------------------------------------
// Readability formulas
// ---------------------------------------------------------------------------

/**
 * Flesch Reading Ease (English)
 * Range: 0–100. Higher = easier. General audience target: 60–70.
 */
export function fleschReadingEase(stats: TextStats): number {
	if (stats.sentences === 0 || stats.words === 0) return 0;
	return 206.835 - 1.015 * stats.avgSentenceLength - 84.6 * stats.avgSyllablesPerWord;
}

/**
 * Flesch-Kincaid Grade Level (English)
 * Returns approximate US school grade level.
 */
export function fleschKincaidGrade(stats: TextStats): number {
	if (stats.sentences === 0 || stats.words === 0) return 0;
	return 0.39 * stats.avgSentenceLength + 11.8 * stats.avgSyllablesPerWord - 15.59;
}

/**
 * Gunning Fog Index (English)
 * Returns approximate years of formal education needed to understand the text.
 */
export function gunningFog(stats: TextStats): number {
	if (stats.sentences === 0 || stats.words === 0) return 0;
	return 0.4 * (stats.avgSentenceLength + (100 * stats.complexWords) / stats.words);
}

/**
 * Flesch Reading Ease adapted for German (Toni Amstad variant).
 * Uses different coefficients than the English formula.
 */
export function fleschReadingEaseDE(stats: TextStats): number {
	if (stats.sentences === 0 || stats.words === 0) return 0;
	return 180 - stats.avgSentenceLength - 58.5 * stats.avgSyllablesPerWord;
}

function buildReadability(stats: TextStats, langCode: string): ReadabilityScores {
	const fre = langCode === 'de' ? fleschReadingEaseDE(stats) : fleschReadingEase(stats);
	return {
		fleschReadingEase: Math.round(fre * 10) / 10,
		fleschKincaidGrade: Math.round(fleschKincaidGrade(stats) * 10) / 10,
		gunningFog: Math.round(gunningFog(stats) * 10) / 10,
		avgSentenceLength: Math.round(stats.avgSentenceLength * 10) / 10,
		avgSyllablesPerWord: Math.round(stats.avgSyllablesPerWord * 100) / 100,
	};
}

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

/**
 * Tokenize plain text for TF-IDF:
 * - Lowercase
 * - Letters only, minimum 3 chars
 * - Filter stopwords
 */
export function tokenize(text: string, stopwords: Set<string>): string[] {
	const words = text.toLowerCase().match(/\b[a-z]{3,}\b/g) ?? [];
	return words.filter((w) => !stopwords.has(w));
}

// ---------------------------------------------------------------------------
// AI slop words (LLM overuse patterns)
// ---------------------------------------------------------------------------

const EN_SLOP_WORDS = new Set(
	`delve leverage landscape tapestry multifaceted pivotal transformative holistic robust nuanced
paradigm synergy beacon cornerstone embark foster underscore realm intricate comprehensive
utilize facilitate actionable empower seamless navigate harness spearhead cultivate streamline
groundbreaking revolutionary unprecedented cutting-edge game-changing innovative disruptive`
		.trim()
		.split(/\s+/),
);

const DE_SLOP_WORDS = new Set(
	`innovativ wegweisend nachhaltig ganzheitlich synergetisch transformativ umfassend entscheidend
richtungsweisend zukunftsweisend bahnbrechend revolutionär einzigartig herausragend`
		.trim()
		.split(/\s+/),
);

const FR_SLOP_WORDS = new Set(
	`innovant révolutionnaire synergique holistique transformatif incontournable essentiel primordial
fondamental crucial décisif novateur`
		.trim()
		.split(/\s+/),
);

const ES_SLOP_WORDS = new Set(
	`innovador revolucionario sinérgico holístico transformador fundamental crucial decisivo
pionero innovativo empoderar potenciar`
		.trim()
		.split(/\s+/),
);

// ---------------------------------------------------------------------------
// Hedging phrases (AI-style qualifiers)
// ---------------------------------------------------------------------------

const EN_HEDGING: readonly string[] = [
	"it's important to note",
	"it's worth noting",
	"it's worth mentioning",
	"in today's digital age",
	'in the realm of',
	'it goes without saying',
	'at the end of the day',
	'when it comes to',
	'serves as a testament',
	'stands as a',
	'not just',
	'in conclusion',
	'to summarize',
	'needless to say',
	'as we all know',
	'it should be noted',
	'it cannot be denied',
];

const DE_HEDGING: readonly string[] = [
	'es ist wichtig zu beachten',
	'es sei darauf hingewiesen',
	'abschließend lässt sich sagen',
	'zusammenfassend',
	'nicht zuletzt',
	'es versteht sich von selbst',
];

const FR_HEDGING: readonly string[] = [
	'il est important de noter',
	'il convient de souligner',
	'en conclusion',
	'pour résumer',
	'il va sans dire',
	'il est à noter',
];

const ES_HEDGING: readonly string[] = [
	'es importante señalar',
	'cabe destacar',
	'en conclusión',
	'en resumen',
	'huelga decir',
	'no hay que olvidar',
];

// ---------------------------------------------------------------------------
// Transition words (sentence-initial overuse patterns)
// ---------------------------------------------------------------------------

const EN_TRANSITIONS = new Set(
	`furthermore moreover additionally however nevertheless nonetheless consequently therefore
thus hence accordingly subsequently meanwhile conversely alternatively specifically
particularly essentially ultimately significantly notably importantly`
		.trim()
		.split(/\s+/),
);

const DE_TRANSITIONS = new Set(
	`außerdem zudem darüber hinaus jedoch dennoch trotzdem folglich daher deshalb somit
infolgedessen unterdessen hingegen`
		.trim()
		.split(/\s+/),
);

const FR_TRANSITIONS = new Set(
	`de plus en outre cependant néanmoins toutefois par conséquent donc ainsi
en revanche par ailleurs notamment`
		.trim()
		.split(/\s+/),
);

const ES_TRANSITIONS = new Set(
	`además sin embargo no obstante por lo tanto por consiguiente así pues
en cambio por otra parte especialmente`
		.trim()
		.split(/\s+/),
);

// ---------------------------------------------------------------------------
// Sentence lengths helper (for burstiness computation)
// ---------------------------------------------------------------------------

/**
 * Split plain text into sentence-level word counts.
 * Splits on `.`, `!`, `?`. Returns one number per non-empty sentence.
 */
export function sentenceLengths(text: string): number[] {
	const sentences = text
		.split(/[.!?]+/)
		.map((s) => s.trim())
		.filter(Boolean);
	return sentences.map((s) => s.split(/\s+/).filter(Boolean).length).filter((n) => n > 0);
}

// ---------------------------------------------------------------------------
// Language kit factory
// ---------------------------------------------------------------------------

/**
 * Return a LanguageKit for the given BCP 47 language code.
 * Falls back to English for unsupported languages.
 */
export function getLanguageKit(langCode: string): LanguageKit {
	const code = langCode.toLowerCase().slice(0, 2);

	let stopwords: Set<string>;
	let aiSlopWords: Set<string>;
	let hedgingPhrases: readonly string[];
	let transitionWords: Set<string>;

	switch (code) {
		case 'de':
			stopwords = DE_STOPWORDS;
			aiSlopWords = DE_SLOP_WORDS;
			hedgingPhrases = DE_HEDGING;
			transitionWords = DE_TRANSITIONS;
			break;
		case 'fr':
			stopwords = FR_STOPWORDS;
			aiSlopWords = FR_SLOP_WORDS;
			hedgingPhrases = FR_HEDGING;
			transitionWords = FR_TRANSITIONS;
			break;
		case 'es':
			stopwords = ES_STOPWORDS;
			aiSlopWords = ES_SLOP_WORDS;
			hedgingPhrases = ES_HEDGING;
			transitionWords = ES_TRANSITIONS;
			break;
		default:
			stopwords = EN_STOPWORDS;
			aiSlopWords = EN_SLOP_WORDS;
			hedgingPhrases = EN_HEDGING;
			transitionWords = EN_TRANSITIONS;
	}

	return {
		code,
		stopwords,
		aiSlopWords,
		hedgingPhrases,
		transitionWords,
		tokenize: (text) => tokenize(text, stopwords),
		textStats: computeTextStats,
		readability: (stats) => buildReadability(stats, code),
	};
}
