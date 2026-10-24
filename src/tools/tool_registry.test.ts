import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { scaffold } from '../build/scaffold.ts';
import { withTmpDir } from '../test_utils.ts';
import { siteRead, TOOLS } from './index.ts';
import { getWebsiteToolByName, listWebsiteToolDefinitions, websiteTools } from './tool_registry.ts';

describe('website tool adapters', () => {
	it('preserves metadata and exposes a fresh registry list', () => {
		assert.equal(websiteTools.length, TOOLS.length);
		assert.notEqual(listWebsiteToolDefinitions(), websiteTools);
		assert.equal(getWebsiteToolByName('missing'), null);
		for (const [index, tool] of websiteTools.entries()) {
			const original = TOOLS[index];
			assert.ok(original);
			assert.equal(getWebsiteToolByName(tool.name), tool);
			for (const key of [
				'name',
				'description',
				'whenToUse',
				'whenNotToUse',
				'inputSchema',
			] as const)
				assert.equal(tool[key], original[key]);
			assert.equal(tool.readOnly, tool.name === 'site_plan');
			assert.equal(tool.sideEffects, tool.name === 'site_plan' ? 'none' : 'writes_state');
		}
	});
	it('reads, writes, builds, checks, and plans through real handlers', async () => {
		await withTmpDir(async (dir) => {
			await scaffold(dir, { name: 'Tools', url: 'https://example.com' });
			const [read, write, build, check, plan] = websiteTools;
			const old = await siteRead.call(dir, { action: 'get_config' });
			const result = await read.handler(dir, { action: 'get_config' });
			assert.equal(result.ok, true);
			assert.equal(result.outcome, 'success');
			assert.ok(result.summary);
			assert.equal(old.status, 'success');
			if (old.status === 'success') assert.deepEqual(result.data, old.data);
			const written = await write.handler(dir, {
				action: 'write_page',
				path: 'adapter.md',
				frontmatter: { title: 'Adapter' },
				content: '# Adapter',
			});
			assert.equal(written.outcome, 'success');
			assert.match(await readFile(join(dir, 'content/adapter.md'), 'utf8'), /# Adapter/);
			assert.equal((await build.handler(dir, { action: 'build' })).outcome, 'success');
			assert.match(
				await readFile(join(dir, 'dist/adapter/index.html'), 'utf8'),
				/<h1>Adapter<\/h1>/,
			);
			assert.equal((await check.handler(dir, {})).outcome, 'success');
			assert.equal((await read.handler(dir, { action: 'fitness' })).outcome, 'success');
			assert.equal(
				JSON.parse(await readFile(join(dir, '.fitness-history.json'), 'utf8')).length,
				2,
			);
			const planned = await plan.handler(dir, {
				changes: [
					{
						kind: 'write_page',
						path: 'adapter.md',
						frontmatter: { title: 'Preview' },
						content: '# Preview',
					},
				],
			});
			assert.equal(planned.outcome, 'success');
			assert.match(await readFile(join(dir, 'content/adapter.md'), 'utf8'), /# Adapter/);
		});
	});
	it('preserves clarification, no-op, and error details', async (t) => {
		await withTmpDir(async (dir) => {
			await scaffold(dir, { name: 'Tools', url: 'https://example.com' });
			const [read, write] = websiteTools;
			const clarification = await read.handler(dir, { action: 'get_page' });
			assert.equal(clarification.ok, false);
			assert.equal(clarification.outcome, 'needs_clarification');
			assert.deepEqual(clarification.next, [{ kind: 'ask_user', message: clarification.summary }]);
			const failureWrite = await write.handler(dir, { action: 'delete_page', path: 'absent.md' });
			assert.equal(failureWrite.outcome, 'error');
			const failure = await read.handler(dir, { action: 'get_page', path: 'absent.md' });
			assert.equal(failure.ok, false);
			assert.equal(failure.outcome, 'error');
			assert.ok(failure.error?.code);
			assert.equal(failure.error?.message, failure.summary);
			t.mock.method(siteRead, 'call', async () => ({
				status: 'no_op',
				message: 'Already present.',
			}));
			assert.deepEqual(await read.handler(dir, { action: 'get_config' }), {
				ok: true,
				outcome: 'no_op',
				summary: 'Already present.',
			});
		});
	});
});
