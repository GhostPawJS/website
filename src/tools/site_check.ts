// ---------------------------------------------------------------------------
// Tool: site_check
//
// Run the fitness system and return actionable, prioritised issues.
// Wraps fitness() / fitnessPage() and surfaces the top issues in a
// token-efficient summary — the LLM does not need to parse the raw report.
// ---------------------------------------------------------------------------

import { fitness, fitnessPage } from '../api/read/fitness.ts';
import type { GscData, Issue } from '../types.ts';
import { catchToError, ok } from './result.ts';
import type { JsonSchema, ToolDef, ToolResult } from './types.ts';

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export interface CheckSummary {
	/** Overall 0–100 fitness score for the site (or the single page). */
	overallScore: number;
	/** Top issues sorted by severity (error > warning > info), capped at 20. */
	topIssues: Array<{
		severity: Issue['severity'];
		dimension: string;
		code: string;
		message: string;
		page?: string;
		fix?: Issue['fix'];
	}>;
	/** Per-dimension breakdown: score (0–100), passed check count, failed check count. */
	dimensionScores: Record<string, { score: number; passed: number; failed: number }>;
	/** Page URLs with the lowest fitness scores, up to 5. */
	weakestPages: Array<{ url: string; score: number }>;
}

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface SiteCheckInput {
	/** Limit the check to a single page URL / file path / slug. */
	page?: string;
	/** Limit the check to specific dimensions. Omit for full report. */
	dimensions?: string[];
	/** Google Search Console data to incorporate. */
	searchConsole?: GscData;
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const inputSchema: JsonSchema = {
	type: 'object',
	description:
		'Run fitness checks. Returns a prioritised issue list with fix suggestions and per-dimension scores.',
	properties: {
		page: {
			type: 'string',
			description:
				'URL, slug, or relative file path to check a single page. Omit for the full site.',
		},
		dimensions: {
			type: 'array',
			items: { type: 'string' },
			description:
				'Scope the report to these dimension names (e.g. ["seo_meta", "content_quality"]).',
		},
		searchConsole: {
			type: 'object',
			description: 'GSC / Bing Webmaster rows to include in the analysis.',
		},
	},
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SEVERITY_ORDER: Record<Issue['severity'], number> = { error: 0, warning: 1, info: 2 };

function summarise(
	overallScore: number,
	allIssues: Issue[],
	dimensionScores: Record<string, { score: number; passed: number; failed: number }>,
	pageScores: Record<string, number>,
): CheckSummary {
	const sorted = [...allIssues].sort(
		(a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
	);

	const weakestPages = Object.entries(pageScores)
		.map(([url, score]) => ({ url, score }))
		.sort((a, b) => a.score - b.score)
		.slice(0, 5);

	return {
		overallScore,
		topIssues: sorted.slice(0, 20).map((i) => ({
			severity: i.severity,
			dimension: i.dimension,
			code: i.code,
			message: i.message,
			...(i.page !== undefined ? { page: i.page } : {}),
			...(i.fix !== undefined ? { fix: i.fix } : {}),
		})),
		dimensionScores,
		weakestPages,
	};
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

async function call(dir: string, input: SiteCheckInput): Promise<ToolResult<CheckSummary>> {
	try {
		if (input.page) {
			// Single-page check
			const score = await fitnessPage(dir, input.page);
			return ok({
				overallScore: score.score,
				topIssues: score.issues.slice(0, 20).map((i) => ({
					severity: i.severity,
					dimension: i.dimension,
					code: i.code,
					message: i.message,
					...(i.page !== undefined ? { page: i.page } : {}),
					...(i.fix !== undefined ? { fix: i.fix } : {}),
				})),
				dimensionScores: {},
				weakestPages: [{ url: score.url, score: score.score }],
			});
		}

		// Full-site check
		const report = await fitness(dir, {
			...(input.dimensions?.length ? { dimensions: input.dimensions } : {}),
			...(input.searchConsole ? { searchConsole: input.searchConsole } : {}),
		});

		const allIssues = Object.values(report.pages).flatMap((ps) => ps.issues);
		const dimensionScores = Object.fromEntries(
			Object.entries(report.dimensions).map(([k, v]) => [
				k,
				{ score: v.score, passed: v.passed, failed: v.failed },
			]),
		);
		const pageScores = Object.fromEntries(
			Object.entries(report.pages).map(([url, ps]) => [url, ps.score]),
		);

		return ok(summarise(report.overall, allIssues, dimensionScores, pageScores));
	} catch (err) {
		return catchToError(err);
	}
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const siteCheck: ToolDef<SiteCheckInput, CheckSummary> = {
	name: 'site_check',
	description:
		'Run the fitness system and return prioritised issues with fix suggestions and dimension scores.',
	whenToUse:
		'After any site_write call. Before planning fixes. When the user asks about SEO, content quality, or readability.',
	whenNotToUse:
		'Do not run after every minor intermediate step — batch related writes first, then check once.',
	inputSchema,
	sideEffects: false,
	call,
};
