import assert from 'node:assert/strict';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { isSiteError } from '../errors.ts';
import { writeFile } from '../fs/write_file.ts';
import { withTmpDir } from '../test_utils.ts';
import { loadDomain, writeDomain } from './domain.ts';
import { appendFitnessHistory, loadFitnessHistory } from './fitness_history.ts';
import { emptyManifest, loadManifest, saveManifest } from './manifest.ts';
import { resolvePaths } from './paths.ts';
import { loadPersona, writePersona } from './persona.ts';
import { defaultSiteConfig, loadSiteConfig, writeSiteConfig } from './site_config.ts';

// ---------------------------------------------------------------------------
// resolvePaths
// ---------------------------------------------------------------------------

describe('resolvePaths', () => {
	it('derives all paths from root', () => {
		const paths = resolvePaths('/my/project');
		assert.equal(paths.root, '/my/project');
		assert.equal(paths.siteJson, '/my/project/site.json');
		assert.equal(paths.domainMd, '/my/project/DOMAIN.md');
		assert.equal(paths.personaMd, '/my/project/PERSONA.md');
		assert.equal(paths.dist, '/my/project/dist');
		assert.equal(paths.buildManifest, '/my/project/.build-manifest.json');
		assert.equal(paths.fitnessHistory, '/my/project/.fitness-history.json');
	});
});

// ---------------------------------------------------------------------------
// loadSiteConfig / writeSiteConfig
// ---------------------------------------------------------------------------

describe('loadSiteConfig', () => {
	it('loads a valid site.json', async () => {
		await withTmpDir(async (dir) => {
			const p = join(dir, 'site.json');
			const cfg = defaultSiteConfig('My Site');
			await writeSiteConfig(p, cfg);
			const loaded = await loadSiteConfig(p);
			assert.equal(loaded.name, 'My Site');
			assert.equal(loaded.url, 'http://localhost:3000');
			assert.equal(loaded.language, 'en');
		});
	});

	it('throws not_found for missing file', async () => {
		await withTmpDir(async (dir) => {
			await assert.rejects(
				() => loadSiteConfig(join(dir, 'site.json')),
				(err: unknown) => isSiteError(err) && err.code === 'not_found',
			);
		});
	});

	it('throws validation for invalid JSON', async () => {
		await withTmpDir(async (dir) => {
			const p = join(dir, 'site.json');
			await writeFile(p, '{ bad json }');
			await assert.rejects(
				() => loadSiteConfig(p),
				(err: unknown) => isSiteError(err) && err.code === 'validation',
			);
		});
	});

	it('throws validation when required fields missing', async () => {
		await withTmpDir(async (dir) => {
			const p = join(dir, 'site.json');
			await writeFile(p, JSON.stringify({ name: 'X' }));
			await assert.rejects(
				() => loadSiteConfig(p),
				(err: unknown) => isSiteError(err) && err.code === 'validation',
			);
		});
	});

	it('throws validation for non-object JSON', async () => {
		await withTmpDir(async (dir) => {
			const p = join(dir, 'site.json');
			await writeFile(p, JSON.stringify([1, 2, 3]));
			await assert.rejects(
				() => loadSiteConfig(p),
				(err: unknown) => isSiteError(err) && err.code === 'validation',
			);
		});
	});

	it('preserves extra fields', async () => {
		await withTmpDir(async (dir) => {
			const p = join(dir, 'site.json');
			await writeFile(
				p,
				JSON.stringify({ name: 'X', url: 'http://x.com', language: 'de', custom: 42 }),
			);
			const cfg = await loadSiteConfig(p);
			assert.equal(cfg.custom, 42);
		});
	});
});

// ---------------------------------------------------------------------------
// loadDomain / writeDomain
// ---------------------------------------------------------------------------

describe('loadDomain / writeDomain', () => {
	it('writes and reads back', async () => {
		await withTmpDir(async (dir) => {
			const p = join(dir, 'DOMAIN.md');
			await writeDomain(p, '# Domain\n\nHello.');
			const content = await loadDomain(p);
			assert.equal(content, '# Domain\n\nHello.');
		});
	});

	it('returns empty string when missing', async () => {
		await withTmpDir(async (dir) => {
			const content = await loadDomain(join(dir, 'DOMAIN.md'));
			assert.equal(content, '');
		});
	});
});

// ---------------------------------------------------------------------------
// loadPersona / writePersona
// ---------------------------------------------------------------------------

describe('loadPersona / writePersona', () => {
	it('writes and reads back', async () => {
		await withTmpDir(async (dir) => {
			const p = join(dir, 'PERSONA.md');
			await writePersona(p, '# Voice');
			assert.equal(await loadPersona(p), '# Voice');
		});
	});

	it('returns empty string when missing', async () => {
		await withTmpDir(async (dir) => {
			assert.equal(await loadPersona(join(dir, 'PERSONA.md')), '');
		});
	});
});

// ---------------------------------------------------------------------------
// manifest
// ---------------------------------------------------------------------------

describe('loadManifest / saveManifest', () => {
	it('returns empty manifest when file is missing', async () => {
		await withTmpDir(async (dir) => {
			const m = await loadManifest(join(dir, '.build-manifest.json'));
			assert.equal(m.version, 1);
			assert.deepEqual(m.pages, {});
		});
	});

	it('round-trips manifest data', async () => {
		await withTmpDir(async (dir) => {
			const p = join(dir, '.build-manifest.json');
			const m = emptyManifest();
			m.pages['/index/'] = { hash: 'abc', mtime: 1234, url: '/index/' };
			await saveManifest(p, m);
			const loaded = await loadManifest(p);
			assert.equal(loaded.pages['/index/']?.hash, 'abc');
		});
	});

	it('returns empty manifest on corrupt JSON', async () => {
		await withTmpDir(async (dir) => {
			const p = join(dir, '.build-manifest.json');
			await writeFile(p, 'not json');
			const m = await loadManifest(p);
			assert.deepEqual(m.pages, {});
		});
	});
});

// ---------------------------------------------------------------------------
// fitnessHistory
// ---------------------------------------------------------------------------

describe('loadFitnessHistory / appendFitnessHistory', () => {
	it('returns empty array when file is missing', async () => {
		await withTmpDir(async (dir) => {
			const h = await loadFitnessHistory(join(dir, '.fitness-history.json'));
			assert.deepEqual(h, []);
		});
	});

	it('appends entries in order', async () => {
		await withTmpDir(async (dir) => {
			const p = join(dir, '.fitness-history.json');
			await appendFitnessHistory(p, { timestamp: 1, overall: 80, dimensions: {} });
			await appendFitnessHistory(p, { timestamp: 2, overall: 85, dimensions: {} });
			const h = await loadFitnessHistory(p);
			assert.equal(h.length, 2);
			assert.equal(h[0]?.overall, 80);
			assert.equal(h[1]?.overall, 85);
		});
	});

	it('caps history at 100 entries', async () => {
		await withTmpDir(async (dir) => {
			const p = join(dir, '.fitness-history.json');
			for (let i = 0; i < 105; i++) {
				await appendFitnessHistory(p, { timestamp: i, overall: i, dimensions: {} });
			}
			const h = await loadFitnessHistory(p);
			assert.equal(h.length, 100);
			assert.equal(h[0]?.overall, 5); // first 5 dropped
		});
	});
});
