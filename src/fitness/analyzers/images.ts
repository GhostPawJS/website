// ---------------------------------------------------------------------------
// Analyzer: images — Image optimization checks
// ---------------------------------------------------------------------------

import { getImages } from '../html_parser.ts';
import type { Analyzer, CheckResult, SiteContext } from '../types.ts';
import { fail, pass } from '../types.ts';

const DIMENSION = 'images';

const FILENAME_RE = /^[a-z0-9][a-z0-9\-_.]*\.(jpg|jpeg|png|gif|svg|webp|avif)$/i;
const LEGACY_FORMATS = new Set(['jpg', 'jpeg', 'png', 'gif']);
const MODERN_FORMATS = new Set(['webp', 'avif']);

export const images: Analyzer = {
	id: 'images',
	dimension: DIMENSION,
	weight: 8,
	applies: (ctx) => ctx.pages.some((p) => getImages(p.html).length > 0),

	analyze(ctx: SiteContext): CheckResult[] {
		const results: CheckResult[] = [];

		for (const page of ctx.pages) {
			const imgs = getImages(page.html);
			if (imgs.length === 0) continue;

			const altTexts = new Set<string>();

			for (const img of imgs) {
				const { src, alt, width, height, loading, srcset } = img;

				// --- alt text ---
				if (!alt && alt !== '') {
					// no alt attribute at all (our extractor returns '' for missing)
					// Actually attrVal returns '' for missing, so we rely on the attribute presence check
				}
				// Check alt attribute presence (empty string is actually ok for decorative images,
				// but we flag missing alt text as an error)
				if (alt === '' && !isDecorativeFilename(src)) {
					results.push(
						fail({
							severity: 'error',
							dimension: DIMENSION,
							code: 'img_alt_missing',
							message: `Image "${src}" has no alt text.`,
							page: page.url,
							element: src,
							fix: { file: page.file, action: 'update_content' },
						}),
					);
				} else {
					results.push(pass);

					// Filename-like alt (e.g. "IMG_1234", "photo-002")
					if (/^(img|dsc|photo|pic|image|screenshot)[-_]?\d+/i.test(alt)) {
						results.push(
							fail({
								severity: 'warning',
								dimension: DIMENSION,
								code: 'img_alt_filename_like',
								message: `Alt text "${alt}" looks like a filename. Use descriptive text.`,
								page: page.url,
								element: src,
								current: alt,
							}),
						);
					} else {
						results.push(pass);
					}

					// Duplicate alt across page
					if (alt && altTexts.has(alt)) {
						results.push(
							fail({
								severity: 'info',
								dimension: DIMENSION,
								code: 'img_alt_duplicate',
								message: `Alt text "${alt}" is duplicated across images on this page.`,
								page: page.url,
								element: src,
							}),
						);
					} else {
						if (alt) altTexts.add(alt);
						results.push(pass);
					}
				}

				// --- width/height attributes (prevents CLS) ---
				if (!width || !height) {
					results.push(
						fail({
							severity: 'warning',
							dimension: DIMENSION,
							code: 'img_dimensions_missing',
							message: `Image "${src}" is missing width/height attributes (causes layout shift).`,
							page: page.url,
							element: src,
							fix: { file: page.file, action: 'update_content' },
						}),
					);
				} else {
					results.push(pass);
				}

				// --- Modern format recommendation ---
				const ext = (src.split('.').pop() ?? '').toLowerCase();
				if (LEGACY_FORMATS.has(ext)) {
					results.push(
						fail({
							severity: 'info',
							dimension: DIMENSION,
							code: 'img_legacy_format',
							message: `Image "${src}" is ${ext.toUpperCase()} — consider WebP or AVIF for better compression.`,
							page: page.url,
							element: src,
							current: ext,
							expected: 'webp or avif',
						}),
					);
				} else if (MODERN_FORMATS.has(ext) || ext === 'svg') {
					results.push(pass);
				}

				// --- Descriptive filename ---
				const filename = src.split('/').pop() ?? '';
				if (!FILENAME_RE.test(filename) && !filename.includes('?')) {
					results.push(
						fail({
							severity: 'info',
							dimension: DIMENSION,
							code: 'img_filename_not_descriptive',
							message: `Image filename "${filename}" is not lowercase/hyphenated.`,
							page: page.url,
							element: src,
						}),
					);
				} else {
					results.push(pass);
				}

				// Suppress unused vars
				void loading;
				void srcset;
			}
		}

		return results;
	},
};

function isDecorativeFilename(src: string): boolean {
	const fn = (src.split('/').pop() ?? '').toLowerCase();
	return (
		fn.includes('icon') || fn.includes('logo') || fn.includes('spacer') || fn.includes('pixel')
	);
}
