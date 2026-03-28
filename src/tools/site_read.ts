// ---------------------------------------------------------------------------
// Tool: site_read
//
// Single entry-point for all read operations.  Dispatches on `action` so the
// LLM needs to learn only one tool instead of eight.
// ---------------------------------------------------------------------------

import * as read from '../api/read/index.ts';
import type { AssetFilter, PageFilter } from '../types.ts';
import { catchToError, needsClarification, ok } from './result.ts';
import type { JsonSchema, ToolDef, ToolResult } from './types.ts';

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

type Action =
	| 'list_pages'
	| 'get_page'
	| 'list_templates'
	| 'get_template'
	| 'list_assets'
	| 'get_asset'
	| 'list_data'
	| 'get_data'
	| 'get_config'
	| 'get_domain'
	| 'get_persona'
	| 'get_structure'
	| 'fitness'
	| 'fitness_page'
	| 'fitness_history';

export interface SiteReadInput {
	action: Action;
	/** Used by get_page, get_template, get_asset, get_data, fitness_page. */
	path?: string;
	/** Filter object passed to list_pages. */
	pageFilter?: PageFilter;
	/** Filter object passed to list_assets. */
	assetFilter?: AssetFilter;
	/** Dimension names to scope the fitness report. */
	dimensions?: string[];
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const inputSchema: JsonSchema = {
	type: 'object',
	description: 'Inspect any part of the site — pages, templates, data, config, fitness.',
	properties: {
		action: {
			type: 'string',
			description: 'What to read.',
			enum: [
				'list_pages',
				'get_page',
				'list_templates',
				'get_template',
				'list_assets',
				'get_asset',
				'list_data',
				'get_data',
				'get_config',
				'get_domain',
				'get_persona',
				'get_structure',
				'fitness',
				'fitness_page',
				'fitness_history',
			],
		},
		path: {
			type: 'string',
			description:
				'Relative path or URL slug — required for get_page, get_template, get_asset, get_data, fitness_page.',
		},
		pageFilter: {
			type: 'object',
			description: 'Optional filter for list_pages (tag, template, slug pattern).',
		},
		assetFilter: {
			type: 'object',
			description: 'Optional filter for list_assets (type, path pattern).',
		},
		dimensions: {
			type: 'array',
			items: { type: 'string' },
			description: 'Scope fitness report to these dimension names only.',
		},
	},
	required: ['action'],
};

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

async function call(dir: string, input: SiteReadInput): Promise<ToolResult> {
	try {
		switch (input.action) {
			case 'list_pages':
				return ok(await read.listPages(dir, input.pageFilter));
			case 'get_page': {
				// Accept `page` or `url` as aliases for `path` (common LLM mistakes)
				const pagePath =
					input.path ??
					(input as SiteReadInput & { page?: string; url?: string }).page ??
					(input as SiteReadInput & { page?: string; url?: string }).url;
				if (!pagePath)
					return needsClarification(
						'get_page requires a `path` field (e.g. path: /blog/my-post/). To list all pages use action: list_pages.',
					);
				return ok(await read.getPage(dir, pagePath));
			}
			case 'list_templates':
				return ok(await read.listTemplates(dir));
			case 'get_template': {
				if (!input.path)
					return needsClarification(
						'get_template requires a `path` field (e.g. path: post.html). To list all templates use action: list_templates.',
					);
				return ok(await read.getTemplate(dir, input.path));
			}
			case 'list_assets':
				return ok(await read.listAssets(dir, input.assetFilter));
			case 'get_asset': {
				if (!input.path)
					return needsClarification(
						'get_asset requires a `path` field (e.g. path: css/styles.css). To list all assets use action: list_assets.',
					);
				return ok(await read.getAsset(dir, input.path));
			}
			case 'list_data':
				return ok(await read.listData(dir));
			case 'get_data': {
				if (!input.path)
					return needsClarification(
						'get_data requires a `path` field (e.g. path: "nav"). To list all data files use action: "list_data".',
					);
				// Strip .json extension — LLMs often pass "nav.json" but the data store uses bare names
				const dataName = input.path.replace(/.json$/i, '');
				return ok(await read.getData(dir, dataName));
			}
			case 'get_config':
				return ok(await read.getConfig(dir));
			case 'get_domain':
				return ok(await read.getDomain(dir));
			case 'get_persona':
				return ok(await read.getPersona(dir));
			case 'get_structure':
				return ok(await read.getStructure(dir));
			case 'fitness':
				return ok(
					await read.fitness(dir, input.dimensions?.length ? { dimensions: input.dimensions } : {}),
				);
			case 'fitness_page': {
				if (!input.path)
					return needsClarification(
						'fitness_page requires a `path` field (e.g. path: /blog/my-post/). To score the whole site use action: "fitness".',
					);
				return ok(await read.fitnessPage(dir, input.path));
			}
			case 'fitness_history':
				return ok(await read.fitnessHistory(dir));
			default:
				return {
					status: 'error',
					code: 'invalid_action',
					message: `Unknown action: ${String((input as SiteReadInput).action)}`,
				};
		}
	} catch (err) {
		return catchToError(err);
	}
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const siteRead: ToolDef<SiteReadInput> = {
	name: 'site_read',
	description:
		'Inspect any part of the site: pages, templates, assets, data, config, fitness reports.',
	whenToUse:
		'Use before writing anything. Use to understand current content, check fitness scores, explore site structure.',
	whenNotToUse: 'Do not use when you already have fresh data from a recent call in the same turn.',
	inputSchema,
	sideEffects: false,
	call,
};
