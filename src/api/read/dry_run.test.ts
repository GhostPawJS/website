import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { scaffold } from '../../build/scaffold.ts';
import { withTmpDir } from '../../test_utils.ts';
import { writePage } from '../write/pages.ts';
import { dryRun } from './dry_run.ts';
import { fitness, fitnessHistory, fitnessPage } from './fitness.ts';

describe('read-only fitness previews', () => {
	it('applies ordered changes to pages, templates, data, and config without writing them', async () => {
		await withTmpDir(async (dir) => {
			await scaffold(dir, { name: 'Preview', url: 'https://example.com' });
			const original = await readFile(join(dir, 'content/index.md'), 'utf8');
			const result = await dryRun(dir, [
				{
					kind: 'write_page',
					path: 'content/index.md',
					frontmatter: { title: 'Changed' },
					content: '# Changed',
				},
				{
					kind: 'write_page',
					path: 'new',
					frontmatter: {
						title: 'A complete guide to mountain travel',
						layout: 'page.html',
						description:
							'A practical introduction to mountain travel, route planning, equipment, weather conditions, and safe preparation for your first journey.',
					},
					content:
						'# A complete guide to mountain travel\n\n' +
						'We walk along the trail. The path leads past the lake. '.repeat(40),
				},
				{ kind: 'write_page', path: 'remove.md', frontmatter: {}, content: 'Remove' },
				{ kind: 'delete_page', path: 'content/remove.md' },
				{ kind: 'write_template', path: 'unused.html', content: '<p>Unused</p>' },
				{ kind: 'delete_template', path: 'unused.html' },
				{ kind: 'write_data', path: 'nested/data.json', content: '{"value":2}' },
				{ kind: 'write_data', path: 'broken.json', content: '{broken' },
				{ kind: 'delete_data', path: 'nested/data.json' },
				{ kind: 'write_config', content: { name: 'Changed' } },
				{ kind: 'write_asset', path: 'image.svg', content: '<svg/>' },
				{ kind: 'delete_asset', path: 'image.svg' },
			]);
			assert.ok(result.before.pages['/']);
			assert.ok(result.after.pages['/new/']);
			assert.equal(result.after.pages['/remove/'], undefined);
			assert.ok(result.diff.affectedPages.includes('/new/'));
			assert.equal(await readFile(join(dir, 'content/index.md'), 'utf8'), original);
			await assert.rejects(readFile(join(dir, 'content/new.md')), { code: 'ENOENT' });
		});
	});
	it('scopes fitness history and looks up individual pages by URL and slug', async () => {
		await withTmpDir(async (dir) => {
			await scaffold(dir, { name: 'Fitness', url: 'https://example.com' });
			await writePage(dir, 'guide.md', { title: 'Mountain guide' }, '# Mountain guide');
			const scoped = await fitness(dir, { dimensions: ['seo_meta'] });
			assert.deepEqual(Object.keys(scoped.dimensions), ['seo_meta']);
			for (const page of Object.values(scoped.pages))
				assert.ok(page.issues.every((issue) => issue.dimension === 'seo_meta'));
			const history = await fitnessHistory(dir);
			assert.equal(history.length, 1);
			assert.deepEqual(Object.keys(history[0]?.dimensions || {}), ['seo_meta']);
			assert.deepEqual(await fitnessPage(dir, '/guide/'), await fitnessPage(dir, 'guide'));
			assert.equal((await fitnessHistory(dir)).length, 1);
			await assert.rejects(fitnessPage(dir, '/absent/'), { code: 'not_found' });
		});
	});
});
