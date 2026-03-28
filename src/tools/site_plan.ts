// ---------------------------------------------------------------------------
// Tool: site_plan
//
// Dry-run proposed changes and return a plain-English impact summary.
// No files are written.  Use this before site_write for any non-trivial edit.
// ---------------------------------------------------------------------------

import { dryRun } from '../api/read/index.ts';
import type { DryRunChange, DryRunResult } from '../types.ts';
import { catchToError, ok } from './result.ts';
import type { JsonSchema, ToolDef, ToolResult } from './types.ts';

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export interface PlanSummary {
	/** Score delta: after.overall − before.overall, rounded to 1 dp. */
	overallDelta: number;
	/** Score before proposed changes. */
	scoreBefore: number;
	/** Score after proposed changes. */
	scoreAfter: number;
	/** Pages whose scores would change (url → delta). */
	pageDeltas: Record<string, number>;
	/** Cannibalization pairs that would be introduced. */
	newCannibalization: DryRunResult['diff']['newCannibalization'];
	/** Cannibalization pairs that would be resolved. */
	resolvedCannibalization: DryRunResult['diff']['resolvedCannibalization'];
	/** Plain-English recommendation. */
	recommendation: string;
}

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface SitePlanInput {
	/** Proposed changes to apply in-memory. */
	changes: DryRunChange[];
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const inputSchema: JsonSchema = {
	type: 'object',
	description:
		'Simulate one or more content changes in-memory and return a fitness impact summary. Nothing is written to disk.',
	properties: {
		changes: {
			type: 'array',
			description: 'Ordered list of changes to apply (same shape as site_write actions).',
			items: {
				type: 'object',
				properties: {
					kind: {
						type: 'string',
						enum: [
							'write_page',
							'delete_page',
							'write_template',
							'delete_template',
							'write_asset',
							'delete_asset',
							'write_data',
							'delete_data',
							'write_config',
						],
					},
					path: { type: 'string' },
					content: { type: 'string' },
					frontmatter: { type: 'object' },
				},
				required: ['kind'],
			},
		},
	},
	required: ['changes'],
};

// ---------------------------------------------------------------------------
// Summary builder
// ---------------------------------------------------------------------------

function buildSummary(result: DryRunResult): PlanSummary {
	const scoreBefore = result.before.overall;
	const scoreAfter = result.after.overall;
	const overallDelta = Math.round((scoreAfter - scoreBefore) * 10) / 10;

	const beforePages = result.diff.before.pages;
	const afterPages = result.diff.after.pages;

	const pageDeltas: Record<string, number> = {};
	for (const url of result.diff.affectedPages) {
		const before = beforePages[url] ?? 0;
		const after = afterPages[url] ?? 0;
		pageDeltas[url] = Math.round((after - before) * 10) / 10;
	}

	const { newCannibalization, resolvedCannibalization } = result.diff;

	const hasPageDeltas = Object.values(pageDeltas).some((d) => d !== 0);
	let recommendation: string;
	if (overallDelta > 0) {
		recommendation = `This change improves the overall fitness score by ${overallDelta} points. Proceed with site_write.`;
	} else if (overallDelta < 0) {
		recommendation = `This change lowers the overall fitness score by ${Math.abs(overallDelta)} points. Reconsider before writing.`;
	} else if (hasPageDeltas) {
		recommendation =
			'Individual page improvements detected (scores shift but average out). Proceed with site_write.';
	} else {
		recommendation =
			'No measurable fitness impact. Safe to proceed if the content change is intentional.';
	}

	if (newCannibalization.length > 0) {
		recommendation += ` Warning: ${newCannibalization.length} new cannibalization pair(s) would be created.`;
	}
	if (resolvedCannibalization.length > 0) {
		recommendation += ` Good: ${resolvedCannibalization.length} existing cannibalization pair(s) would be resolved.`;
	}

	return {
		overallDelta,
		scoreBefore,
		scoreAfter,
		pageDeltas,
		newCannibalization,
		resolvedCannibalization,
		recommendation,
	};
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

async function call(dir: string, input: SitePlanInput): Promise<ToolResult<PlanSummary>> {
	if (!input.changes?.length) {
		return {
			status: 'needs_clarification',
			question: 'No changes provided. What content changes should be simulated?',
		};
	}

	try {
		const result = await dryRun(dir, input.changes);
		return ok(buildSummary(result));
	} catch (err) {
		return catchToError(err);
	}
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const sitePlan: ToolDef<SitePlanInput, PlanSummary> = {
	name: 'site_plan',
	description:
		'Simulate proposed content changes in-memory and return a fitness delta summary. Nothing is written.',
	whenToUse:
		'Before any non-trivial site_write call. Use to confirm a change improves (or at least does not harm) fitness, and to spot cannibalization before it happens.',
	whenNotToUse:
		'Do not use for trivial fixes (typos, broken links) where fitness impact is obvious. Do not use in a loop — plan once, then write.',
	inputSchema,
	sideEffects: false,
	call,
};
