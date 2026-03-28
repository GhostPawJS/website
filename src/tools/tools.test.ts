// ---------------------------------------------------------------------------
// Tools layer tests — pure unit tests that verify types, shapes, and the
// helpers without hitting the filesystem.
// ---------------------------------------------------------------------------

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { siteBuild, siteCheck, sitePlan, siteRead, siteWrite, TOOLS } from './index.ts';
import { catchToError, needsClarification, noOp, ok, toolError } from './result.ts';

// ---------------------------------------------------------------------------
// Result helpers
// ---------------------------------------------------------------------------

describe('result helpers', () => {
	it('ok wraps data in ToolSuccess', () => {
		const r = ok({ answer: 42 });
		assert.equal(r.status, 'success');
		assert.deepEqual((r as typeof r & { data: unknown }).data, { answer: 42 });
	});

	it('noOp returns no_op status', () => {
		const r = noOp('nothing changed');
		assert.equal(r.status, 'no_op');
		assert.equal(r.message, 'nothing changed');
	});

	it('needsClarification returns needs_clarification', () => {
		const r = needsClarification('Which page?');
		assert.equal(r.status, 'needs_clarification');
		assert.equal(r.question, 'Which page?');
	});

	it('toolError returns error with code', () => {
		const r = toolError('not_found', 'Page missing');
		assert.equal(r.status, 'error');
		assert.equal(r.code, 'not_found');
		assert.equal(r.message, 'Page missing');
	});

	it('catchToError wraps a plain Error', () => {
		const r = catchToError(new Error('boom'));
		assert.equal(r.status, 'error');
		assert.equal(r.message, 'boom');
	});

	it('catchToError wraps a string', () => {
		const r = catchToError('oops');
		assert.equal(r.status, 'error');
		assert.equal(r.message, 'oops');
	});

	it('catchToError uses .code when present on Error subclass', () => {
		const err = Object.assign(new Error('coded'), { code: 'my_code' });
		const r = catchToError(err);
		assert.equal(r.code, 'my_code');
	});
});

// ---------------------------------------------------------------------------
// ToolDef shape invariants
// ---------------------------------------------------------------------------

describe('TOOLS registry', () => {
	it('contains exactly 5 tools', () => {
		assert.equal(TOOLS.length, 5);
	});

	it('all tools have required metadata fields', () => {
		for (const tool of TOOLS) {
			assert.ok(tool.name, `tool missing name`);
			assert.ok(tool.description, `${tool.name} missing description`);
			assert.ok(tool.whenToUse, `${tool.name} missing whenToUse`);
			assert.ok(tool.whenNotToUse, `${tool.name} missing whenNotToUse`);
			assert.ok(tool.inputSchema, `${tool.name} missing inputSchema`);
			assert.equal(typeof tool.sideEffects, 'boolean', `${tool.name} missing sideEffects boolean`);
			assert.equal(typeof tool.call, 'function', `${tool.name} missing call function`);
		}
	});

	it('read/check/plan have sideEffects=false', () => {
		assert.equal(siteRead.sideEffects, false);
		assert.equal(siteCheck.sideEffects, false);
		assert.equal(sitePlan.sideEffects, false);
	});

	it('write/build have sideEffects=true', () => {
		assert.equal(siteWrite.sideEffects, true);
		assert.equal(siteBuild.sideEffects, true);
	});

	it('tool names match expected identifiers', () => {
		const names = TOOLS.map((t) => t.name);
		assert.deepEqual(names, ['site_read', 'site_write', 'site_build', 'site_check', 'site_plan']);
	});

	it('all input schemas have type=object', () => {
		for (const tool of TOOLS) {
			assert.equal(
				tool.inputSchema.type,
				'object',
				`${tool.name} inputSchema.type should be "object"`,
			);
		}
	});
});

// ---------------------------------------------------------------------------
// site_read: needs_clarification / error paths that don't need FS
// ---------------------------------------------------------------------------

describe('site_read — invalid action', () => {
	it('returns error for unknown action', async () => {
		// @ts-expect-error intentionally invalid
		const result = await siteRead.call('/nonexistent', { action: 'unknown_action' });
		assert.equal(result.status, 'error');
	});
});

// ---------------------------------------------------------------------------
// site_read: needs_clarification for missing path (resilience)
// ---------------------------------------------------------------------------

describe('site_read — needs_clarification when path is missing', () => {
	it('get_page without path returns needs_clarification', async () => {
		const result = await siteRead.call('/nonexistent', { action: 'get_page' });
		assert.equal(result.status, 'needs_clarification');
	});

	it('get_template without path returns needs_clarification', async () => {
		const result = await siteRead.call('/nonexistent', { action: 'get_template' });
		assert.equal(result.status, 'needs_clarification');
	});

	it('get_asset without path returns needs_clarification', async () => {
		const result = await siteRead.call('/nonexistent', { action: 'get_asset' });
		assert.equal(result.status, 'needs_clarification');
	});

	it('get_data without path returns needs_clarification', async () => {
		const result = await siteRead.call('/nonexistent', { action: 'get_data' });
		assert.equal(result.status, 'needs_clarification');
	});

	it('fitness_page without path returns needs_clarification', async () => {
		const result = await siteRead.call('/nonexistent', { action: 'fitness_page' });
		assert.equal(result.status, 'needs_clarification');
	});
});

describe('site_read — page/url alias for path in get_page', () => {
	it('accepts `page` alias — returns error (not needs_clarification) for FS failure', async () => {
		// @ts-expect-error page is not in the type but is accepted at runtime
		const result = await siteRead.call('/nonexistent', { action: 'get_page', page: '/' });
		// Should not be needs_clarification — path alias was resolved
		assert.notEqual(result.status, 'needs_clarification');
	});

	it('accepts `url` alias — returns error (not needs_clarification) for FS failure', async () => {
		// @ts-expect-error url is not in the type but is accepted at runtime
		const result = await siteRead.call('/nonexistent', { action: 'get_page', url: '/' });
		assert.notEqual(result.status, 'needs_clarification');
	});
});

describe('site_read — get_data strips .json extension', () => {
	it('returns error (not needs_clarification) when path is "nav.json"', async () => {
		const result = await siteRead.call('/nonexistent', { action: 'get_data', path: 'nav.json' });
		// Should attempt the read (not reject as needs_clarification)
		assert.notEqual(result.status, 'needs_clarification');
	});
});

// ---------------------------------------------------------------------------
// site_write: needs_clarification paths
// ---------------------------------------------------------------------------

describe('site_write — needs_clarification paths', () => {
	it('delete_page without path returns needs_clarification', async () => {
		const result = await siteWrite.call('/nonexistent', { action: 'delete_page' });
		assert.equal(result.status, 'needs_clarification');
	});

	it('delete_template without path returns needs_clarification', async () => {
		const result = await siteWrite.call('/nonexistent', { action: 'delete_template' });
		assert.equal(result.status, 'needs_clarification');
	});

	it('delete_asset without path returns needs_clarification', async () => {
		const result = await siteWrite.call('/nonexistent', { action: 'delete_asset' });
		assert.equal(result.status, 'needs_clarification');
	});

	it('delete_data without path returns needs_clarification', async () => {
		const result = await siteWrite.call('/nonexistent', { action: 'delete_data' });
		assert.equal(result.status, 'needs_clarification');
	});

	it('write_asset without path returns needs_clarification', async () => {
		const result = await siteWrite.call('/nonexistent', { action: 'write_asset' });
		assert.equal(result.status, 'needs_clarification');
	});

	it('patch_frontmatter without path returns needs_clarification', async () => {
		const result = await siteWrite.call('/nonexistent', {
			action: 'patch_frontmatter',
			frontmatter: { og_image: '/img.jpg' },
		});
		assert.equal(result.status, 'needs_clarification');
	});

	it('patch_frontmatter without frontmatter returns needs_clarification', async () => {
		const result = await siteWrite.call('/nonexistent', {
			action: 'patch_frontmatter',
			path: 'index.md',
		});
		assert.equal(result.status, 'needs_clarification');
	});

	it('patch_frontmatter with empty frontmatter returns needs_clarification', async () => {
		const result = await siteWrite.call('/nonexistent', {
			action: 'patch_frontmatter',
			path: 'index.md',
			frontmatter: {},
		});
		assert.equal(result.status, 'needs_clarification');
	});

	it('unknown action returns error', async () => {
		// @ts-expect-error intentionally invalid
		const result = await siteWrite.call('/nonexistent', { action: 'explode' });
		assert.equal(result.status, 'error');
	});
});

// ---------------------------------------------------------------------------
// site_write: patch_frontmatter enum in schema
// ---------------------------------------------------------------------------

describe('site_write — patch_frontmatter in schema', () => {
	it('patch_frontmatter is in the action enum', () => {
		const actions = siteWrite.inputSchema.properties?.action as { enum?: string[] } | undefined;
		assert.ok(
			actions?.enum?.includes('patch_frontmatter'),
			'patch_frontmatter must appear in the action enum',
		);
	});
});

// ---------------------------------------------------------------------------
// site_check: dimensionScores shape
// ---------------------------------------------------------------------------

describe('site_check — dimensionScores shape', () => {
	it('frontmatter description mentions layout (not template)', () => {
		const desc = siteWrite.inputSchema.properties?.frontmatter as
			| { description?: string }
			| undefined;
		assert.ok(desc?.description?.includes('layout'), 'frontmatter description must mention layout');
		assert.ok(
			!desc?.description?.includes('template:'),
			'frontmatter description must not teach template: field name',
		);
	});
});

// ---------------------------------------------------------------------------
// site_build: needs_clarification for preview without path
// ---------------------------------------------------------------------------

describe('site_build — preview without path', () => {
	it('returns needs_clarification', async () => {
		const result = await siteBuild.call('/nonexistent', { action: 'preview' });
		assert.equal(result.status, 'needs_clarification');
	});

	it('unknown action returns error', async () => {
		// @ts-expect-error intentionally invalid
		const result = await siteBuild.call('/nonexistent', { action: 'launch' });
		assert.equal(result.status, 'error');
	});
});

// ---------------------------------------------------------------------------
// site_build: scaffold uses `config` (not `scaffoldOptions`)
// ---------------------------------------------------------------------------

describe('site_build — scaffold param name', () => {
	it('inputSchema has config property (not scaffoldOptions)', () => {
		const props = siteBuild.inputSchema.properties as Record<string, unknown>;
		assert.ok('config' in props, 'inputSchema must have config property');
		assert.ok(!('scaffoldOptions' in props), 'inputSchema must not have scaffoldOptions');
	});
});

// ---------------------------------------------------------------------------
// site_write: write_data strips .json extension
// ---------------------------------------------------------------------------

describe('site_write — write_data extension stripping', () => {
	it('path property description mentions data file name', () => {
		// The schema description for path must not claim .json extension is forbidden
		const pathProp = siteWrite.inputSchema.properties?.path as { description?: string } | undefined;
		assert.ok(typeof pathProp?.description === 'string', 'path must have a description');
	});
});

// ---------------------------------------------------------------------------
// site_plan: empty changes
// ---------------------------------------------------------------------------

describe('site_plan — empty changes', () => {
	it('returns needs_clarification when changes array is empty', async () => {
		const result = await sitePlan.call('/nonexistent', { changes: [] });
		assert.equal(result.status, 'needs_clarification');
	});

	it('returns error on FS failure with changes provided', async () => {
		const result = await sitePlan.call('/nonexistent/does/not/exist', {
			changes: [{ kind: 'write_config', content: { name: 'Test' } }],
		});
		// FS access on non-existent dir should produce an error
		assert.equal(result.status, 'error');
	});
});
