// ---------------------------------------------------------------------------
// Analyzer: content_quality — Readability, word count, freshness, structure
// ---------------------------------------------------------------------------

import type { Analyzer, CheckResult, SiteContext } from '../types.ts';
import { fail, pass } from '../types.ts';

const DIMENSION = 'content_quality';

// Word count thresholds by page type (detected from layout frontmatter)
const WORD_COUNT_THRESHOLDS: Record<string, number> = {
	post: 1000,
	blog: 1000,
	article: 1000,
	guide: 2000,
	product: 300,
	page: 300,
};

const DEFAULT_MIN_WORDS = 300;
/** Flesch Reading Ease: below this is "difficult" for general audiences. */
const FK_EASE_MIN = 40;
/** Gunning Fog: above this level is "very hard" for general audiences. */
const FOG_MAX = 18;
/** Days before a page is considered stale. */
const STALE_DAYS = 180;
const CRITICAL_STALE_DAYS = 365;
/** Max words in a block before it should have a break (heading/list/image). */
const MAX_PARA_DENSITY_WORDS = 300;

export const contentQuality: Analyzer = {
	id: 'content_quality',
	dimension: DIMENSION,
	weight: 12,
	applies: () => true,

	analyze(ctx: SiteContext): CheckResult[] {
		const results: CheckResult[] = [];
		const now = Date.now();

		for (const page of ctx.pages) {
			const { url, textContent, wordCount, frontmatter, html } = page;

			// --- Word count ---
			const layout = frontmatter.layout ? String(frontmatter.layout).replace('.html', '') : 'page';
			const minWords = WORD_COUNT_THRESHOLDS[layout] ?? DEFAULT_MIN_WORDS;
			if (wordCount < minWords) {
				results.push(
					fail({
						severity: wordCount < minWords / 2 ? 'error' : 'warning',
						dimension: DIMENSION,
						code: 'word_count_low',
						message: `Page has ${wordCount} words (recommended ≥ ${minWords} for "${layout}" layout).`,
						page: url,
						current: String(wordCount),
						expected: `≥ ${minWords}`,
						fix: { file: page.file, action: 'add_content' },
					}),
				);
			} else {
				results.push(pass);
			}

			// --- Readability ---
			const stats = ctx.language.textStats(textContent);
			const readability = ctx.language.readability(stats);

			if (stats.words >= 100) {
				// Flesch Reading Ease
				if (readability.fleschReadingEase < FK_EASE_MIN) {
					results.push(
						fail({
							severity: 'warning',
							dimension: DIMENSION,
							code: 'readability_low',
							message: `Flesch Reading Ease is ${readability.fleschReadingEase} (below ${FK_EASE_MIN} — difficult to read).`,
							page: url,
							current: String(readability.fleschReadingEase),
							expected: `≥ ${FK_EASE_MIN}`,
						}),
					);
				} else {
					results.push(pass);
				}

				// Gunning Fog
				if (readability.gunningFog > FOG_MAX) {
					results.push(
						fail({
							severity: 'info',
							dimension: DIMENSION,
							code: 'gunning_fog_high',
							message: `Gunning Fog index is ${readability.gunningFog} (above ${FOG_MAX} — very hard).`,
							page: url,
							current: String(readability.gunningFog),
							expected: `≤ ${FOG_MAX}`,
						}),
					);
				} else {
					results.push(pass);
				}
			}

			// --- Content freshness ---
			const dateStr = frontmatter.dateModified ?? frontmatter.date;
			if (dateStr) {
				const ts = Date.parse(String(dateStr));
				if (!Number.isNaN(ts)) {
					const ageMs = now - ts;
					const ageDays = ageMs / 86_400_000;
					if (ageDays > CRITICAL_STALE_DAYS) {
						results.push(
							fail({
								severity: 'warning',
								dimension: DIMENSION,
								code: 'content_stale_critical',
								message: `Page was last modified ${Math.floor(ageDays)} days ago (>${CRITICAL_STALE_DAYS} days — consider updating).`,
								page: url,
								current: String(dateStr),
								fix: { file: page.file, action: 'update_content' },
							}),
						);
					} else if (ageDays > STALE_DAYS) {
						results.push(
							fail({
								severity: 'info',
								dimension: DIMENSION,
								code: 'content_stale',
								message: `Page was last modified ${Math.floor(ageDays)} days ago (>${STALE_DAYS} days).`,
								page: url,
								current: String(dateStr),
							}),
						);
					} else {
						results.push(pass);
					}
				}
			}

			// --- Paragraph density (wall of text detection) ---
			// Count words between heading/list/image markers in plain text
			const segments = html.split(/<(?:h[1-6]|ul|ol|li|img|figure|blockquote|table)\b/i);
			let wallFound = false;
			for (const seg of segments) {
				const words = seg
					.replace(/<[^>]+>/g, ' ')
					.trim()
					.split(/\s+/)
					.filter(Boolean);
				if (words.length > MAX_PARA_DENSITY_WORDS) {
					wallFound = true;
					break;
				}
			}
			if (wallFound) {
				results.push(
					fail({
						severity: 'info',
						dimension: DIMENSION,
						code: 'paragraph_density_high',
						message: `Page has a block of >${MAX_PARA_DENSITY_WORDS} words without a heading, list, or image break.`,
						page: url,
						fix: { file: page.file, action: 'update_content' },
					}),
				);
			} else if (wordCount > 0) {
				results.push(pass);
			}
		}

		return results;
	},
};
