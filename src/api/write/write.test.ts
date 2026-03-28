import assert from 'node:assert/strict';
import { readFile as fsReadFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { scaffold } from '../../build/scaffold.ts';
import { isSiteError } from '../../errors.ts';
import { withTmpDir } from '../../test_utils.ts';
import { deleteAsset, writeAsset } from './assets.ts';
import { writeConfig } from './config.ts';
import { deleteData, writeData } from './data.ts';
import { writeDomain } from './domain.ts';
import { deletePage, patchPage, writePage } from './pages.ts';
import { writePersona } from './persona.ts';
import { deleteTemplate, writeTemplate } from './templates.ts';

async function withScaffold<T>(fn: (dir: string) => Promise<T>): Promise<T> {
	return withTmpDir(async (dir) => {
		await scaffold(dir, { name: 'Test Site', url: 'https://example.com' });
		return fn(dir);
	});
}

// ---------------------------------------------------------------------------
// writeConfig
// ---------------------------------------------------------------------------

describe('writeConfig', () => {
	it('merges partial into site.json', async () => {
		await withScaffold(async (dir) => {
			await writeConfig(dir, { name: 'Updated Site' });
			const raw = await fsReadFile(join(dir, 'site.json'), 'utf8');
			const cfg = JSON.parse(raw);
			assert.equal(cfg.name, 'Updated Site');
			assert.equal(cfg.url, 'https://example.com'); // preserved
		});
	});

	it('preserves existing keys not in partial', async () => {
		await withScaffold(async (dir) => {
			await writeConfig(dir, { language: 'fr' });
			const raw = await fsReadFile(join(dir, 'site.json'), 'utf8');
			const cfg = JSON.parse(raw);
			assert.equal(cfg.language, 'fr');
			assert.equal(cfg.name, 'Test Site'); // unchanged
		});
	});
});

// ---------------------------------------------------------------------------
// writeDomain
// ---------------------------------------------------------------------------

describe('writeDomain', () => {
	it('writes DOMAIN.md content', async () => {
		await withScaffold(async (dir) => {
			await writeDomain(dir, 'This is the domain context.');
			const raw = await fsReadFile(join(dir, 'DOMAIN.md'), 'utf8');
			assert.equal(raw, 'This is the domain context.');
		});
	});
});

// ---------------------------------------------------------------------------
// writePersona
// ---------------------------------------------------------------------------

describe('writePersona', () => {
	it('writes PERSONA.md content', async () => {
		await withScaffold(async (dir) => {
			await writePersona(dir, 'This is the persona.');
			const raw = await fsReadFile(join(dir, 'PERSONA.md'), 'utf8');
			assert.equal(raw, 'This is the persona.');
		});
	});
});

// ---------------------------------------------------------------------------
// writePage / deletePage
// ---------------------------------------------------------------------------

describe('writePage', () => {
	it('creates a markdown file with frontmatter', async () => {
		await withScaffold(async (dir) => {
			await writePage(dir, 'blog/new-post.md', { title: 'New Post', draft: false }, '# Hello');
			const raw = await fsReadFile(join(dir, 'content/blog/new-post.md'), 'utf8');
			assert.ok(raw.includes('title: New Post'), raw);
			assert.ok(raw.includes('# Hello'), raw);
		});
	});

	it('appends .md extension if missing', async () => {
		await withScaffold(async (dir) => {
			await writePage(dir, 'blog/no-ext', { title: 'No Ext' }, 'Body.');
			const raw = await fsReadFile(join(dir, 'content/blog/no-ext.md'), 'utf8');
			assert.ok(raw.includes('title: No Ext'));
		});
	});

	it('overwrites existing page', async () => {
		await withScaffold(async (dir) => {
			await writePage(dir, 'index.md', { title: 'Home v2' }, 'Updated home.');
			const raw = await fsReadFile(join(dir, 'content/index.md'), 'utf8');
			assert.ok(raw.includes('Home v2'), raw);
		});
	});

	it('throws validation error for path traversal', async () => {
		await withScaffold(async (dir) => {
			try {
				await writePage(dir, '../escape.md', { title: 'Bad' }, 'Bad.');
				assert.fail('expected validation error');
			} catch (err) {
				assert.ok(isSiteError(err) && err.code === 'validation');
			}
		});
	});
});

describe('deletePage', () => {
	it('deletes an existing page', async () => {
		await withScaffold(async (dir) => {
			await writePage(dir, 'temp.md', { title: 'Temp' }, 'Temp.');
			await deletePage(dir, 'temp.md');
			try {
				await fsReadFile(join(dir, 'content/temp.md'), 'utf8');
				assert.fail('file should not exist');
			} catch (err) {
				assert.ok((err as NodeJS.ErrnoException).code === 'ENOENT');
			}
		});
	});

	it('throws not_found when deleting nonexistent page', async () => {
		await withScaffold(async (dir) => {
			try {
				await deletePage(dir, 'no-such-page.md');
				assert.fail('expected not_found error');
			} catch (err) {
				assert.ok(isSiteError(err) && err.code === 'not_found');
			}
		});
	});
});

// ---------------------------------------------------------------------------
// patchPage
// ---------------------------------------------------------------------------

describe('patchPage', () => {
	it('merges new frontmatter fields without touching body', async () => {
		await withScaffold(async (dir) => {
			await writePage(
				dir,
				'patch-test.md',
				{ title: 'Original', layout: 'page.html' },
				'Body content here.',
			);
			await patchPage(dir, 'patch-test.md', { og_image: '/img/hero.jpg' });
			const raw = await fsReadFile(join(dir, 'content/patch-test.md'), 'utf8');
			assert.ok(raw.includes('title: Original'), 'title should be preserved');
			assert.ok(raw.includes('layout: page.html'), 'layout should be preserved');
			assert.ok(raw.includes('og_image:'), 'og_image should be added');
			assert.ok(raw.includes('/img/hero.jpg'), 'og_image value should be correct');
			assert.ok(raw.includes('Body content here.'), 'body must be preserved unchanged');
		});
	});

	it('overwrites existing frontmatter key', async () => {
		await withScaffold(async (dir) => {
			await writePage(dir, 'patch-test2.md', { title: 'Old Title', layout: 'page.html' }, 'Body.');
			await patchPage(dir, 'patch-test2.md', { title: 'New Title' });
			const raw = await fsReadFile(join(dir, 'content/patch-test2.md'), 'utf8');
			assert.ok(raw.includes('title: New Title'), 'title should be updated');
			assert.ok(!raw.includes('Old Title'), 'old title should be gone');
			assert.ok(raw.includes('layout: page.html'), 'layout should be preserved');
			assert.ok(raw.includes('Body.'), 'body must be preserved');
		});
	});

	it('patches array-of-objects frontmatter (faqs)', async () => {
		await withScaffold(async (dir) => {
			await writePage(dir, 'faq-patch.md', { title: 'FAQ', layout: 'faq.html' }, 'Intro.');
			await patchPage(dir, 'faq-patch.md', {
				faqs: [{ q: 'What is it?', a: 'A builder.' }],
			});
			const raw = await fsReadFile(join(dir, 'content/faq-patch.md'), 'utf8');
			assert.ok(raw.includes('- q:'), 'faqs should be serialized as block sequence');
			assert.ok(raw.includes('What is it?'), 'faq question should be present');
			assert.ok(raw.includes('Intro.'), 'body must be preserved');
		});
	});

	it('throws not_found for nonexistent page', async () => {
		await withScaffold(async (dir) => {
			try {
				await patchPage(dir, 'no-such.md', { title: 'X' });
				assert.fail('expected not_found error');
			} catch (err) {
				assert.ok(isSiteError(err) && err.code === 'not_found');
			}
		});
	});

	it('throws validation error for path traversal', async () => {
		await withScaffold(async (dir) => {
			try {
				await patchPage(dir, '../escape.md', { title: 'Bad' });
				assert.fail('expected validation error');
			} catch (err) {
				assert.ok(isSiteError(err) && err.code === 'validation');
			}
		});
	});
});

// ---------------------------------------------------------------------------
// writeTemplate / deleteTemplate
// ---------------------------------------------------------------------------

describe('writeTemplate', () => {
	it('creates a template file', async () => {
		await withScaffold(async (dir) => {
			await writeTemplate(dir, 'custom.html', '<html>custom</html>');
			const raw = await fsReadFile(join(dir, 'templates/custom.html'), 'utf8');
			assert.equal(raw, '<html>custom</html>');
		});
	});

	it('throws validation error for non-html extension', async () => {
		await withScaffold(async (dir) => {
			try {
				await writeTemplate(dir, 'bad.txt', 'content');
				assert.fail('expected validation error');
			} catch (err) {
				assert.ok(isSiteError(err) && err.code === 'validation');
			}
		});
	});

	it('throws validation error for path traversal', async () => {
		await withScaffold(async (dir) => {
			try {
				await writeTemplate(dir, '../escape.html', 'content');
				assert.fail('expected validation error');
			} catch (err) {
				assert.ok(isSiteError(err) && err.code === 'validation');
			}
		});
	});
});

describe('deleteTemplate', () => {
	it('deletes an existing template', async () => {
		await withScaffold(async (dir) => {
			await writeTemplate(dir, 'temp.html', '<html>temp</html>');
			await deleteTemplate(dir, 'temp.html');
			try {
				await fsReadFile(join(dir, 'templates/temp.html'), 'utf8');
				assert.fail('file should not exist');
			} catch (err) {
				assert.ok((err as NodeJS.ErrnoException).code === 'ENOENT');
			}
		});
	});

	it('throws not_found when template does not exist', async () => {
		await withScaffold(async (dir) => {
			try {
				await deleteTemplate(dir, 'nonexistent.html');
				assert.fail('expected not_found error');
			} catch (err) {
				assert.ok(isSiteError(err) && err.code === 'not_found');
			}
		});
	});
});

// ---------------------------------------------------------------------------
// writeData / deleteData
// ---------------------------------------------------------------------------

describe('writeData', () => {
	it('writes a JSON data file', async () => {
		await withScaffold(async (dir) => {
			await writeData(dir, 'test', { key: 'value', num: 42 });
			const raw = await fsReadFile(join(dir, 'data/test.json'), 'utf8');
			const parsed = JSON.parse(raw);
			assert.equal(parsed.key, 'value');
			assert.equal(parsed.num, 42);
		});
	});

	it('overwrites existing data file', async () => {
		await withScaffold(async (dir) => {
			await writeData(dir, 'nav', [{ label: 'Custom Nav' }]);
			const raw = await fsReadFile(join(dir, 'data/nav.json'), 'utf8');
			const parsed = JSON.parse(raw);
			assert.deepEqual(parsed, [{ label: 'Custom Nav' }]);
		});
	});
});

describe('deleteData', () => {
	it('deletes an existing data file', async () => {
		await withScaffold(async (dir) => {
			await writeData(dir, 'temp', { x: 1 });
			await deleteData(dir, 'temp');
			try {
				await fsReadFile(join(dir, 'data/temp.json'), 'utf8');
				assert.fail('file should not exist');
			} catch (err) {
				assert.ok((err as NodeJS.ErrnoException).code === 'ENOENT');
			}
		});
	});

	it('throws not_found when data file does not exist', async () => {
		await withScaffold(async (dir) => {
			try {
				await deleteData(dir, 'nonexistent');
				assert.fail('expected not_found error');
			} catch (err) {
				assert.ok(isSiteError(err) && err.code === 'not_found');
			}
		});
	});
});

// ---------------------------------------------------------------------------
// writeAsset / deleteAsset
// ---------------------------------------------------------------------------

describe('writeAsset', () => {
	it('writes a text asset file', async () => {
		await withScaffold(async (dir) => {
			await writeAsset(dir, 'css/extra.css', 'body { margin: 0; }');
			const raw = await fsReadFile(join(dir, 'assets/css/extra.css'), 'utf8');
			assert.equal(raw, 'body { margin: 0; }');
		});
	});

	it('writes a Buffer asset file', async () => {
		await withScaffold(async (dir) => {
			const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // PNG magic bytes
			await writeAsset(dir, 'img/test.png', buf);
			const content = await fsReadFile(join(dir, 'assets/img/test.png'));
			assert.deepEqual(content.slice(0, 4), buf);
		});
	});

	it('throws validation error for path traversal', async () => {
		await withScaffold(async (dir) => {
			try {
				await writeAsset(dir, '../escape.txt', 'bad');
				assert.fail('expected validation error');
			} catch (err) {
				assert.ok(isSiteError(err) && err.code === 'validation');
			}
		});
	});

	it('throws validation error for absolute path', async () => {
		await withScaffold(async (dir) => {
			try {
				await writeAsset(dir, '/absolute.txt', 'bad');
				assert.fail('expected validation error');
			} catch (err) {
				assert.ok(isSiteError(err) && err.code === 'validation');
			}
		});
	});
});

describe('deleteAsset', () => {
	it('deletes an existing asset', async () => {
		await withScaffold(async (dir) => {
			await writeAsset(dir, 'css/temp.css', '.temp{}');
			await deleteAsset(dir, 'css/temp.css');
			try {
				await fsReadFile(join(dir, 'assets/css/temp.css'), 'utf8');
				assert.fail('file should not exist');
			} catch (err) {
				assert.ok((err as NodeJS.ErrnoException).code === 'ENOENT');
			}
		});
	});

	it('throws not_found when asset does not exist', async () => {
		await withScaffold(async (dir) => {
			try {
				await deleteAsset(dir, 'css/nonexistent.css');
				assert.fail('expected not_found error');
			} catch (err) {
				assert.ok(isSiteError(err) && err.code === 'not_found');
			}
		});
	});
});
