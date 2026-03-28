// ---------------------------------------------------------------------------
// Tool: site_build
//
// Build, preview, serve, clean, and scaffold operations.
// ---------------------------------------------------------------------------

import type { BuildOptions, ScaffoldOptions } from '../api/build/index.ts';
import * as apiBuild from '../api/build/index.ts';
import { catchToError, ok } from './result.ts';
import type { JsonSchema, ToolDef, ToolResult } from './types.ts';

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

type Action = 'build' | 'preview' | 'serve' | 'stop' | 'clean' | 'scaffold';

export interface SiteBuildInput {
	action: Action;
	/** URL path to preview — used by `preview` action. */
	path?: string;
	/** Options passed to `build`. */
	buildOptions?: BuildOptions;
	/** Dev server port. Default: 3000. Used by `serve`. */
	port?: number;
	/** Initial config for the new site — used by scaffold. */
	config?: ScaffoldOptions;
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const inputSchema: JsonSchema = {
	type: 'object',
	description: 'Build, preview, serve, stop, clean, or scaffold the site.',
	properties: {
		action: {
			type: 'string',
			description: 'The build operation to perform.',
			enum: ['build', 'preview', 'serve', 'stop', 'clean', 'scaffold'],
		},
		path: {
			type: 'string',
			description: 'URL path to preview a single page (preview action only).',
		},
		buildOptions: {
			type: 'object',
			description: 'Options forwarded to the build pipeline.',
		},
		port: {
			type: 'number',
			description: 'Dev server port for the serve action. Default: 3000.',
		},
		config: {
			type: 'object',
			description: 'Initial site config for scaffold — e.g. { name, url, language }.',
		},
	},
	required: ['action'],
};

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

async function call(dir: string, input: SiteBuildInput): Promise<ToolResult> {
	try {
		switch (input.action) {
			case 'build': {
				const result = await apiBuild.build(dir, input.buildOptions);
				return ok({
					pageCount: result.pages.length,
					duration: result.duration,
				});
			}
			case 'preview': {
				if (!input.path) {
					return { status: 'needs_clarification', question: 'Which URL path should be previewed?' };
				}
				const page = await apiBuild.preview(dir, input.path);
				return ok(page);
			}
			case 'serve': {
				const instance = await apiBuild.serve(dir, { port: input.port ?? 3000 });
				return ok({ url: instance.url, port: instance.port });
			}
			case 'stop': {
				await apiBuild.stop(dir);
				return ok(undefined);
			}
			case 'clean': {
				await apiBuild.clean(dir);
				return ok(undefined);
			}
			case 'scaffold': {
				const result = await apiBuild.scaffold(dir, input.config);
				return ok(result);
			}
			default:
				return {
					status: 'error',
					code: 'invalid_action',
					message: `Unknown action: ${String((input as SiteBuildInput).action)}`,
				};
		}
	} catch (err) {
		return catchToError(err);
	}
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const siteBuild: ToolDef<SiteBuildInput> = {
	name: 'site_build',
	description: 'Build the site to disk, preview a single page, run the dev server, or scaffold.',
	whenToUse:
		'Use build to produce final HTML. Use preview to inspect rendered output for one page. Use serve to start a local dev server. Use scaffold to initialise a new project.',
	whenNotToUse:
		'Do not build inside a site_plan dry-run loop — site_plan handles its own rendering.',
	inputSchema,
	sideEffects: true,
	call,
};
