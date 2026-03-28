// ---------------------------------------------------------------------------
// Analyzer: technical — HTML and asset quality checks
// Checks: doctype, duplicate IDs, inline styles/scripts, asset refs
// ---------------------------------------------------------------------------

import {
	getDuplicateIds,
	hasBodyInlineScripts,
	hasBodyInlineStyles,
	hasDoctype,
} from '../html_parser.ts';
import type { Analyzer, CheckResult, SiteContext } from '../types.ts';
import { fail, pass } from '../types.ts';

const DIMENSION = 'technical';

export const technical: Analyzer = {
	id: 'technical',
	dimension: DIMENSION,
	weight: 8,
	applies: () => true,

	analyze(ctx: SiteContext): CheckResult[] {
		const results: CheckResult[] = [];

		for (const page of ctx.pages) {
			const { url, html } = page;

			// --- HTML5 doctype ---
			if (!hasDoctype(html)) {
				results.push(
					fail({
						severity: 'error',
						dimension: DIMENSION,
						code: 'missing_doctype',
						message: `Page "${url}" is missing <!DOCTYPE html>.`,
						page: url,
						fix: { file: 'templates/base.html', action: 'update_template' },
					}),
				);
			} else {
				results.push(pass);
			}

			// --- Duplicate IDs ---
			const dupIds = getDuplicateIds(html);
			if (dupIds.length > 0) {
				results.push(
					fail({
						severity: 'error',
						dimension: DIMENSION,
						code: 'duplicate_ids',
						message: `Duplicate element IDs found: ${dupIds.slice(0, 3).join(', ')}${dupIds.length > 3 ? ` (+${dupIds.length - 3} more)` : ''}.`,
						page: url,
						element: dupIds[0] as string,
						fix: { file: page.file, action: 'update_content' },
					}),
				);
			} else {
				results.push(pass);
			}

			// --- Inline styles in body ---
			if (hasBodyInlineStyles(html)) {
				results.push(
					fail({
						severity: 'warning',
						dimension: DIMENSION,
						code: 'inline_styles',
						message: `Page "${url}" contains inline <style> tags in the body. Move to assets/css/.`,
						page: url,
						fix: { file: page.file, action: 'update_content' },
					}),
				);
			} else {
				results.push(pass);
			}

			// --- Inline scripts in body (non-JSON-LD) ---
			if (hasBodyInlineScripts(html)) {
				results.push(
					fail({
						severity: 'warning',
						dimension: DIMENSION,
						code: 'inline_scripts',
						message: `Page "${url}" contains inline <script> tags. Move to assets/js/.`,
						page: url,
						fix: { file: page.file, action: 'update_content' },
					}),
				);
			} else {
				results.push(pass);
			}
		}

		return results;
	},
};
