// ---------------------------------------------------------------------------
// Tool: site_write
//
// Single entry-point for all write/delete operations.
// Always run site_check after writing to verify fitness impact.
// ---------------------------------------------------------------------------

import * as write from '../api/write/index.ts';
import type { PageFrontmatter, SiteConfig } from '../types.ts';
import { catchToError, ok } from './result.ts';
import type { JsonSchema, ToolDef, ToolResult } from './types.ts';

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

type Action =
	| 'write_page'
	| 'patch_frontmatter'
	| 'delete_page'
	| 'write_template'
	| 'delete_template'
	| 'write_asset'
	| 'delete_asset'
	| 'write_data'
	| 'delete_data'
	| 'write_config'
	| 'write_domain'
	| 'write_persona';

export interface SiteWriteInput {
	action: Action;
	/** Path relative to the relevant directory (content/, templates/, assets/, data/). */
	path?: string;
	/** Frontmatter for write_page. */
	frontmatter?: PageFrontmatter;
	/** Markdown body for write_page, HTML for write_template, text for write_domain/persona. */
	content?: string;
	/** Parsed JSON for write_data. */
	json?: unknown;
	/** Partial config object for write_config. */
	config?: Partial<SiteConfig>;
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const inputSchema: JsonSchema = {
	type: 'object',
	description:
		'Create, update, or delete site content, templates, data, assets, or config. Use patch_frontmatter to update individual frontmatter fields without touching the page body.',
	properties: {
		action: {
			type: 'string',
			description: 'What to write or delete.',
			enum: [
				'write_page',
				'patch_frontmatter',
				'delete_page',
				'write_template',
				'delete_template',
				'write_asset',
				'delete_asset',
				'write_data',
				'delete_data',
				'write_config',
				'write_domain',
				'write_persona',
			],
		},
		path: {
			type: 'string',
			description:
				'Relative path within the target directory. E.g. "blog/my-post.md" for write_page.',
		},
		frontmatter: {
			type: 'object',
			description:
				'Page frontmatter fields for write_page and patch_frontmatter. Key fields: title, description, layout (e.g. "page.html"), og_image. Values may be strings, numbers, booleans, or arrays of objects (e.g. faqs: [{q, a}], breadcrumb: [{label, href}]).',
		},
		content: {
			type: 'string',
			description:
				'Markdown body (write_page), HTML content (write_template), or text (write_domain, write_persona).',
		},
		json: {
			type: 'object',
			description: 'Parsed JSON value for write_data.',
		},
		config: {
			type: 'object',
			description: 'Partial site.json fields to merge. write_config only.',
		},
	},
	required: ['action'],
};

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

async function call(dir: string, input: SiteWriteInput): Promise<ToolResult<void>> {
	try {
		switch (input.action) {
			case 'write_page': {
				const path = input.path ?? 'untitled.md';
				const fm = input.frontmatter ?? {};
				const body = input.content ?? '';
				await write.writePage(dir, path, fm as PageFrontmatter, body);
				return ok(undefined);
			}
			case 'patch_frontmatter': {
				if (!input.path) {
					return {
						status: 'needs_clarification',
						question: 'Which page path should be patched? Provide path relative to content/.',
					};
				}
				if (!input.frontmatter || Object.keys(input.frontmatter).length === 0) {
					return {
						status: 'needs_clarification',
						question: 'No frontmatter fields provided. Which fields should be updated?',
					};
				}
				await write.patchPage(dir, input.path, input.frontmatter as Record<string, unknown>);
				return ok(undefined);
			}
			case 'delete_page': {
				if (!input.path) {
					return { status: 'needs_clarification', question: 'Which page path should be deleted?' };
				}
				await write.deletePage(dir, input.path);
				return ok(undefined);
			}
			case 'write_template': {
				const name = input.path ?? 'untitled.html';
				await write.writeTemplate(dir, name, input.content ?? '');
				return ok(undefined);
			}
			case 'delete_template': {
				if (!input.path) {
					return {
						status: 'needs_clarification',
						question: 'Which template name should be deleted?',
					};
				}
				await write.deleteTemplate(dir, input.path);
				return ok(undefined);
			}
			case 'write_asset': {
				if (!input.path) {
					return { status: 'needs_clarification', question: 'Which asset path should be written?' };
				}
				await write.writeAsset(dir, input.path, input.content ?? '');
				return ok(undefined);
			}
			case 'delete_asset': {
				if (!input.path) {
					return { status: 'needs_clarification', question: 'Which asset path should be deleted?' };
				}
				await write.deleteAsset(dir, input.path);
				return ok(undefined);
			}
			case 'write_data': {
				const name = (input.path ?? 'untitled').replace(/\.json$/i, '');
				await write.writeData(dir, name, input.json ?? {});
				return ok(undefined);
			}
			case 'delete_data': {
				if (!input.path) {
					return { status: 'needs_clarification', question: 'Which data file should be deleted?' };
				}
				await write.deleteData(dir, input.path.replace(/\.json$/i, ''));
				return ok(undefined);
			}
			case 'write_config': {
				await write.writeConfig(dir, input.config ?? {});
				return ok(undefined);
			}
			case 'write_domain': {
				await write.writeDomain(dir, input.content ?? '');
				return ok(undefined);
			}
			case 'write_persona': {
				await write.writePersona(dir, input.content ?? '');
				return ok(undefined);
			}
			default:
				return {
					status: 'error',
					code: 'invalid_action',
					message: `Unknown action: ${String((input as SiteWriteInput).action)}`,
				};
		}
	} catch (err) {
		return catchToError(err);
	}
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const siteWrite: ToolDef<SiteWriteInput, void> = {
	name: 'site_write',
	description:
		'Create, update, or delete pages, templates, assets, data, config, domain doc, or persona.',
	whenToUse:
		'Use after site_plan confirms the change improves fitness, or to implement a content edit. Always follow with site_check.',
	whenNotToUse:
		'Do not use without first running site_plan to preview the fitness impact of non-trivial changes.',
	inputSchema,
	sideEffects: true,
	call,
};
