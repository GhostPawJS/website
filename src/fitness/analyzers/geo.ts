// ---------------------------------------------------------------------------
// Analyzer: geo — Generative Engine Optimization (GEO) signals
//
// Checks signals that improve visibility in AI-powered search engines and
// large language model citations (ChatGPT, Perplexity, Claude, Gemini, etc.)
// ---------------------------------------------------------------------------

import { getHeadings } from '../html_parser.ts';
import type { Analyzer, CheckResult, SiteContext } from '../types.ts';
import { fail, pass } from '../types.ts';

const DIMENSION = 'geo';

const INTERROGATIVE_RE = /^(who|what|when|where|why|how)\b/i;
const BLOCKQUOTE_RE = /<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi;
const FRESHNESS_RE = /\bupdated\b|\blast\s+updated\b/i;
const CAPITALIZED_TOKEN_RE = /\b[A-Z][a-z]+\b/g;
const SENTENCE_START_RE = /(?:^|[.!?]\s+)[A-Z][a-z]+/g;

const AI_CRAWLERS = ['GPTBot', 'ClaudeBot', 'PerplexityBot'] as const;

export const geo: Analyzer = {
	id: 'geo',
	dimension: DIMENSION,
	weight: 8,
	applies: () => true,

	analyze(ctx: SiteContext): CheckResult[] {
		const results: CheckResult[] = [];

		// --- Site-level: ai_crawler_robots (checked once) ---
		for (const crawler of AI_CRAWLERS) {
			if (!ctx.robotsTxt.includes(crawler)) {
				results.push(
					fail({
						severity: 'warning',
						dimension: DIMENSION,
						code: 'ai_crawler_robots',
						message: `GEO: robots.txt does not explicitly address ${crawler} — AI crawlers may be blocked unintentionally.`,
						page: '/',
						fix: { file: 'assets/robots.txt', action: 'update_content' },
					}),
				);
			} else {
				results.push(pass);
			}
		}

		// --- Per-page checks ---
		for (const page of ctx.pages) {
			const { url, html, wordCount, frontmatter, textContent } = page;

			// 1. direct_answer_structure — interrogative headings
			const headings = getHeadings(html);
			const h2h3 = headings.filter((h) => h.level === 2 || h.level === 3);
			if (h2h3.length > 0) {
				const hasInterrogative = h2h3.some((h) => INTERROGATIVE_RE.test(h.text.trim()));
				if (!hasInterrogative && wordCount >= 500) {
					results.push(
						fail({
							severity: 'info',
							dimension: DIMENSION,
							code: 'direct_answer_structure',
							message: `GEO: No question-based headings found on "${url}" — interrogative headings followed by direct answers improve AI snippet extraction.`,
							page: url,
							fix: { file: page.file, action: 'set_frontmatter', field: 'description' },
						}),
					);
				} else {
					results.push(pass);
				}
			}

			// 2. blockquote_citation — blockquotes should have <cite> or data-source
			const blockquoteRe = new RegExp(BLOCKQUOTE_RE.source, 'gi');
			let bqMatch: RegExpExecArray | null;
			let bqFound = false;
			for (;;) {
				bqMatch = blockquoteRe.exec(html);
				if (!bqMatch) break;
				bqFound = true;
				const content = bqMatch[1] as string;
				const hasCite = /<cite/i.test(content) || /data-source/i.test(content);
				if (!hasCite) {
					results.push(
						fail({
							severity: 'warning',
							dimension: DIMENSION,
							code: 'blockquote_citation',
							message: `GEO: Blockquote on "${url}" has no <cite> or data-source attribute — cited sources improve AI trustworthiness signals.`,
							page: url,
							element: 'blockquote',
							fix: { file: page.file, action: 'update_content' },
						}),
					);
				} else {
					results.push(pass);
				}
			}
			if (!bqFound) {
				// No blockquotes on this page — not a failure, just skip
			}

			// 3. content_freshness_signal — pages >= 300 words
			if (wordCount >= 300) {
				const hasDateModified = Boolean(frontmatter.dateModified);
				const hasFreshnessText = FRESHNESS_RE.test(textContent);
				if (!hasDateModified && !hasFreshnessText) {
					results.push(
						fail({
							severity: 'info',
							dimension: DIMENSION,
							code: 'content_freshness_signal',
							message: `GEO: No content freshness signal found on "${url}" — AI engines prefer content with visible update dates.`,
							page: url,
							fix: { file: page.file, action: 'set_frontmatter', field: 'dateModified' },
						}),
					);
				} else {
					results.push(pass);
				}
			}

			// 4. entity_richness — pages >= 200 words
			if (wordCount >= 200) {
				const capitalizedMatches = textContent.match(CAPITALIZED_TOKEN_RE) ?? [];
				const sentenceStartMatches = textContent.match(SENTENCE_START_RE) ?? [];
				// Subtract sentence-start capitals as a rough deduction
				const entityCount = Math.max(0, capitalizedMatches.length - sentenceStartMatches.length);
				const entityRatio = (entityCount / wordCount) * 100;
				if (entityRatio < 1) {
					results.push(
						fail({
							severity: 'info',
							dimension: DIMENSION,
							code: 'entity_richness',
							message: `GEO: Low entity density on "${url}" (${entityRatio.toFixed(1)} per 100 words) — include proper nouns, organizations, and locations to improve AI citation potential.`,
							page: url,
							current: `${entityRatio.toFixed(1)} entities per 100 words`,
							expected: '≥ 1 entity per 100 words',
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
