import assert from 'node:assert/strict';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { scaffold } from '../../build/scaffold.ts';
import { isSiteError } from '../../errors.ts';
import { writeFile } from '../../fs/write_file.ts';
import { withTmpDir } from '../../test_utils.ts';
import { getAsset, listAssets } from './assets.ts';
import { getConfig, getDomain, getPersona } from './config.ts';
import { getData, listData } from './data.ts';
import { fitness, fitnessHistory } from './fitness.ts';
import { getPage, listPages } from './pages.ts';
import { getStructure } from './structure.ts';
import { getTemplate, listTemplates } from './templates.ts';

// ---------------------------------------------------------------------------
// Helpers — build a minimal scaffolded project for tests
// ---------------------------------------------------------------------------

async function withScaffold<T>(fn: (dir: string) => Promise<T>): Promise<T> {
	return withTmpDir(async (dir) => {
		await scaffold(dir, { name: 'Test Site', url: 'https://example.com' });
		return fn(dir);
	});
}

// ---------------------------------------------------------------------------
// getConfig / getDomain / getPersona
// ---------------------------------------------------------------------------

describe('getConfig', () => {
	it('returns parsed site.json', async () => {
		await withScaffold(async (dir) => {
			const cfg = await getConfig(dir);
			assert.equal(cfg.name, 'Test Site');
			assert.equal(cfg.url, 'https://example.com');
		});
	});
});

describe('getDomain', () => {
	it('returns DOMAIN.md content', async () => {
		await withScaffold(async (dir) => {
			const domain = await getDomain(dir);
			assert.equal(typeof domain, 'string');
		});
	});

	it('returns empty string when DOMAIN.md absent', async () => {
		await withTmpDir(async (dir) => {
			// No scaffold — DOMAIN.md doesn't exist
			const domain = await getDomain(dir);
			assert.equal(domain, '');
		});
	});
});

describe('getPersona', () => {
	it('returns PERSONA.md content', async () => {
		await withScaffold(async (dir) => {
			const persona = await getPersona(dir);
			assert.equal(typeof persona, 'string');
		});
	});

	it('returns empty string when PERSONA.md absent', async () => {
		await withTmpDir(async (dir) => {
			const persona = await getPersona(dir);
			assert.equal(persona, '');
		});
	});
});

// ---------------------------------------------------------------------------
// listPages / getPage
// ---------------------------------------------------------------------------

describe('listPages', () => {
	it('returns at least one page for a scaffolded project', async () => {
		await withScaffold(async (dir) => {
			const pages = await listPages(dir);
			assert.ok(pages.length >= 1, 'expected at least one page');
		});
	});

	it('each page has required fields', async () => {
		await withScaffold(async (dir) => {
			const pages = await listPages(dir);
			for (const p of pages) {
				assert.equal(typeof p.url, 'string');
				assert.equal(typeof p.path, 'string');
				assert.equal(typeof p.wordCount, 'number');
				assert.ok(p.readability);
			}
		});
	});

	it('filter by url prefix', async () => {
		await withScaffold(async (dir) => {
			// Write a blog post to create a filtered group
			await writeFile(
				join(dir, 'content/blog/post.md'),
				'---\ntitle: Blog Post\n---\nContent here.',
			);
			const all = await listPages(dir);
			const blog = await listPages(dir, { url: '/blog/' });
			assert.ok(blog.length < all.length);
			assert.ok(blog.every((p) => p.url.startsWith('/blog/')));
		});
	});

	it('filter by collection', async () => {
		await withScaffold(async (dir) => {
			await writeFile(
				join(dir, 'content/blog/post.md'),
				'---\ntitle: Post\ncollection: blog\n---\nContent.',
			);
			const blog = await listPages(dir, { collection: 'blog' });
			assert.ok(blog.every((p) => p.collection === 'blog'));
		});
	});
});

describe('getPage', () => {
	it('returns page detail by URL', async () => {
		await withScaffold(async (dir) => {
			const pages = await listPages(dir);
			const first = pages[0];
			assert.ok(first);
			const detail = await getPage(dir, first.url);
			assert.equal(detail.url, first.url);
			assert.equal(typeof detail.html, 'string');
			assert.equal(typeof detail.markdown, 'string');
			assert.ok(Array.isArray(detail.tfidfTopTerms));
		});
	});

	it('throws not_found for unknown path', async () => {
		await withScaffold(async (dir) => {
			try {
				await getPage(dir, '/no-such-page/');
				assert.fail('expected not_found error');
			} catch (err) {
				assert.ok(isSiteError(err) && err.code === 'not_found');
			}
		});
	});

	it('returns page detail by file path suffix', async () => {
		await withScaffold(async (dir) => {
			const detail = await getPage(dir, 'index.md');
			assert.ok(detail.url === '/' || detail.url.includes('/'));
		});
	});
});

// ---------------------------------------------------------------------------
// listTemplates / getTemplate
// ---------------------------------------------------------------------------

describe('listTemplates', () => {
	it('returns templates from scaffolded project', async () => {
		await withScaffold(async (dir) => {
			const templates = await listTemplates(dir);
			assert.ok(templates.length >= 1);
		});
	});

	it('each template has name and chain', async () => {
		await withScaffold(async (dir) => {
			const templates = await listTemplates(dir);
			for (const t of templates) {
				assert.equal(typeof t.name, 'string');
				assert.ok(Array.isArray(t.chain));
			}
		});
	});
});

describe('getTemplate', () => {
	it('returns template content by name', async () => {
		await withScaffold(async (dir) => {
			const templates = await listTemplates(dir);
			const first = templates[0];
			assert.ok(first);
			const content = await getTemplate(dir, first.name);
			assert.equal(typeof content, 'string');
			assert.ok(content.length > 0);
		});
	});

	it('throws not_found for unknown template', async () => {
		await withScaffold(async (dir) => {
			try {
				await getTemplate(dir, 'nonexistent.html');
				assert.fail('expected not_found error');
			} catch (err) {
				assert.ok(isSiteError(err) && err.code === 'not_found');
			}
		});
	});
});

// ---------------------------------------------------------------------------
// listData / getData
// ---------------------------------------------------------------------------

describe('listData', () => {
	it('returns data files from scaffolded project', async () => {
		await withScaffold(async (dir) => {
			const data = await listData(dir);
			assert.ok(data.length >= 1);
		});
	});

	it('each data entry has name and shape', async () => {
		await withScaffold(async (dir) => {
			const data = await listData(dir);
			for (const d of data) {
				assert.equal(typeof d.name, 'string');
				assert.ok(Array.isArray(d.shape));
			}
		});
	});
});

describe('getData', () => {
	it('returns parsed data by name', async () => {
		await withScaffold(async (dir) => {
			const list = await listData(dir);
			const first = list[0];
			assert.ok(first);
			const data = await getData(dir, first.name);
			assert.ok(data !== null && data !== undefined);
		});
	});

	it('throws not_found for unknown data file', async () => {
		await withScaffold(async (dir) => {
			try {
				await getData(dir, 'nonexistent');
				assert.fail('expected not_found error');
			} catch (err) {
				assert.ok(isSiteError(err) && err.code === 'not_found');
			}
		});
	});
});

// ---------------------------------------------------------------------------
// listAssets / getAsset
// ---------------------------------------------------------------------------

describe('listAssets', () => {
	it('returns asset files from scaffolded project', async () => {
		await withScaffold(async (dir) => {
			const assets = await listAssets(dir);
			assert.ok(assets.length >= 1);
		});
	});

	it('each asset has required fields', async () => {
		await withScaffold(async (dir) => {
			const assets = await listAssets(dir);
			for (const a of assets) {
				assert.equal(typeof a.path, 'string');
				assert.equal(typeof a.mimeType, 'string');
				assert.equal(typeof a.size, 'number');
			}
		});
	});

	it('filter by mimeType prefix', async () => {
		await withScaffold(async (dir) => {
			const cssAssets = await listAssets(dir, { mimeType: 'text/css' });
			assert.ok(cssAssets.every((a) => a.mimeType === 'text/css'));
		});
	});
});

describe('getAsset', () => {
	it('returns text content for a CSS file', async () => {
		await withScaffold(async (dir) => {
			const assets = await listAssets(dir, { mimeType: 'text/css' });
			const first = assets[0];
			assert.ok(first);
			const detail = await getAsset(dir, first.path);
			assert.equal(typeof detail.content, 'string');
		});
	});

	it('throws not_found for unknown asset', async () => {
		await withScaffold(async (dir) => {
			try {
				await getAsset(dir, 'css/nonexistent.css');
				assert.fail('expected not_found error');
			} catch (err) {
				assert.ok(isSiteError(err) && err.code === 'not_found');
			}
		});
	});
});

// ---------------------------------------------------------------------------
// getStructure
// ---------------------------------------------------------------------------

describe('getStructure', () => {
	it('returns hierarchy, links, collections, clusters', async () => {
		await withScaffold(async (dir) => {
			const structure = await getStructure(dir);
			assert.ok(typeof structure.hierarchy === 'object');
			assert.ok(typeof structure.links === 'object');
			assert.ok(typeof structure.collections === 'object');
			assert.ok(Array.isArray(structure.clusters));
		});
	});

	it('homepage has null parent in hierarchy', async () => {
		await withScaffold(async (dir) => {
			const structure = await getStructure(dir);
			if ('/' in structure.hierarchy) {
				assert.equal(structure.hierarchy['/'], null);
			}
		});
	});
});

// ---------------------------------------------------------------------------
// fitness / fitnessHistory
// ---------------------------------------------------------------------------

describe('fitness', () => {
	it('returns a fitness report with overall score', async () => {
		await withScaffold(async (dir) => {
			const report = await fitness(dir);
			assert.equal(typeof report.overall, 'number');
			assert.ok(report.overall >= 0 && report.overall <= 100);
			assert.ok(typeof report.dimensions === 'object');
		});
	});

	it('scopes report when dimensions filter provided', async () => {
		await withScaffold(async (dir) => {
			const report = await fitness(dir, { dimensions: ['seo'] });
			const keys = Object.keys(report.dimensions);
			assert.ok(
				keys.every((k) => k === 'seo'),
				`unexpected dimensions: ${keys.join(', ')}`,
			);
		});
	});

	it('appends to history on each call', async () => {
		await withScaffold(async (dir) => {
			await fitness(dir);
			await fitness(dir);
			const history = await fitnessHistory(dir);
			assert.ok(history.length >= 2);
		});
	});
});

describe('fitnessHistory', () => {
	it('returns empty array when no history exists', async () => {
		await withTmpDir(async (dir) => {
			// Minimal project — no scaffold, no history file
			const history = await fitnessHistory(dir);
			assert.deepEqual(history, []);
		});
	});
});
