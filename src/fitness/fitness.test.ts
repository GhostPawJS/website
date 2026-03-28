import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { build } from '../build/build.ts';
import { scaffold } from '../build/scaffold.ts';
import { withTmpDir } from '../test_utils.ts';
import type { RenderedPage } from '../types.ts';
import { seoMeta } from './analyzers/seo_meta.ts';
import { buildSiteContext } from './context.ts';
import { fitness } from './runner.ts';
import { computeDimensionScore, computeOverallScore } from './score.ts';

// ---------------------------------------------------------------------------
// score helpers
// ---------------------------------------------------------------------------

describe('computeDimensionScore', () => {
	it('all passing → score 100', () => {
		const ds = computeDimensionScore([{ pass: true }, { pass: true }]);
		assert.equal(ds.score, 100);
		assert.equal(ds.passed, 2);
		assert.equal(ds.failed, 0);
		assert.equal(ds.issues.length, 0);
	});

	it('one error → score 88', () => {
		const ds = computeDimensionScore([
			{
				pass: false,
				issue: { severity: 'error', dimension: 'd', code: 'c', message: 'm', page: '/' },
			},
		]);
		assert.equal(ds.score, 88); // 100 - 12
		assert.equal(ds.failed, 1);
		assert.equal(ds.issues.length, 1);
	});

	it('one warning → score 95', () => {
		const ds = computeDimensionScore([
			{
				pass: false,
				issue: { severity: 'warning', dimension: 'd', code: 'c', message: 'm', page: '/' },
			},
		]);
		assert.equal(ds.score, 95); // 100 - 5
	});

	it('info issues do not deduct points', () => {
		const ds = computeDimensionScore([
			{
				pass: false,
				issue: { severity: 'info', dimension: 'd', code: 'c', message: 'm', page: '/' },
			},
		]);
		assert.equal(ds.score, 100);
	});

	it('score clamps at 0', () => {
		// 10 errors = 120 pts deducted → clamped to 0
		const results = Array.from({ length: 10 }, () => ({
			pass: false as const,
			issue: { severity: 'error' as const, dimension: 'd', code: 'c', message: 'm', page: '/' },
		}));
		const ds = computeDimensionScore(results);
		assert.equal(ds.score, 0);
	});

	it('empty results → perfect score', () => {
		const ds = computeDimensionScore([]);
		assert.equal(ds.score, 100);
		assert.equal(ds.passed, 0);
		assert.equal(ds.failed, 0);
	});
});

describe('computeOverallScore', () => {
	it('returns 100 for empty input', () => {
		assert.equal(computeOverallScore([]), 100);
	});

	it('returns weighted average', () => {
		const score = computeOverallScore([
			{ score: 100, weight: 1 },
			{ score: 0, weight: 1 },
		]);
		assert.equal(score, 50);
	});

	it('weights higher-weight dimensions more', () => {
		const score = computeOverallScore([
			{ score: 80, weight: 3 },
			{ score: 20, weight: 1 },
		]);
		// (80*3 + 20*1) / 4 = (240+20)/4 = 65
		assert.equal(score, 65);
	});
});

// ---------------------------------------------------------------------------
// buildSiteContext + fitness integration
// ---------------------------------------------------------------------------

/** Minimal RenderedPage for testing. */
function makePage(
	url: string,
	opts: {
		title?: string;
		description?: string;
		wordCount?: number;
		html?: string;
		textContent?: string;
		frontmatter?: Record<string, unknown>;
	} = {},
): RenderedPage {
	const title = opts.title ?? 'Test Page';
	const description = opts.description ?? 'A test page description for testing.';
	const lang = 'en';
	const html =
		opts.html ??
		`<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8">
<title>${title}</title>
<meta name="description" content="${description}">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="canonical" href="https://test.com${url}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="https://test.com${url}">
<meta property="og:type" content="website">
</head>
<body>
<h1>${title}</h1>
<p>${opts.textContent ?? 'Content for this test page. '.repeat(30)}</p>
</body>
</html>`;

	return {
		file: `content${url}index.md`,
		slug: url.replace(/^\/|\/$/g, '') || 'index',
		url,
		frontmatter: {
			title,
			description,
			...opts.frontmatter,
		},
		html,
		textContent: opts.textContent ?? `${title} Content for this test page. `.repeat(20),
		wordCount: opts.wordCount ?? 100,
	};
}

// ---------------------------------------------------------------------------
// seo_meta analyzer — threshold checks
// ---------------------------------------------------------------------------

describe('seo_meta — title thresholds', () => {
	const config = { name: 'Test', url: 'https://test.com', language: 'en' };
	const paths = {
		root: '/tmp',
		siteJson: '/tmp/s.json',
		domainMd: '/tmp/d.md',
		personaMd: '/tmp/p.md',
		assets: '/tmp/a',
		templates: '/tmp/t',
		content: '/tmp/c',
		data: '/tmp/d2',
		dist: '/tmp/dist',
		buildManifest: '/tmp/.bm.json',
		fitnessHistory: '/tmp/.fh.json',
	};

	function makeHtmlPage(title: string, description: string, url: string): RenderedPage {
		const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${title}</title><meta name="description" content="${description}"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="canonical" href="https://test.com${url}"><meta property="og:title" content="${title}"><meta property="og:url" content="https://test.com${url}"><meta property="og:type" content="website"></head><body><h1>${title}</h1><p>${'Content '.repeat(50)}</p></body></html>`;
		return {
			file: `content${url}index.md`,
			slug: 'test',
			url,
			frontmatter: { title, description },
			html,
			textContent: `${title} ${'Content '.repeat(50)}`,
			wordCount: 55,
		};
	}

	it('title of 9 chars fires title_too_short', async () => {
		const page = makeHtmlPage(
			'Short Ti',
			'A description long enough to pass the 70 char minimum threshold here',
			'/',
		);
		const ctx = await buildSiteContext([page], config, paths);
		const results = seoMeta.analyze(ctx);
		const codes = results.filter((r) => !r.pass).map((r) => r.issue?.code);
		assert.ok(
			codes.includes('title_too_short'),
			`Expected title_too_short, got: ${JSON.stringify(codes)}`,
		);
	});

	it('title of 10 chars does NOT fire title_too_short', async () => {
		const page = makeHtmlPage(
			'Short Titl',
			'A description long enough to pass the 70 char minimum threshold here ok',
			'/',
		);
		const ctx = await buildSiteContext([page], config, paths);
		const results = seoMeta.analyze(ctx);
		const codes = results.filter((r) => !r.pass).map((r) => r.issue?.code);
		assert.ok(
			!codes.includes('title_too_short'),
			`Should not fire at 10 chars, got: ${JSON.stringify(codes)}`,
		);
	});

	it('description of 69 chars fires description_too_short', async () => {
		const shortDesc = 'A'.repeat(69);
		const page = makeHtmlPage('A title long enough', shortDesc, '/');
		const ctx = await buildSiteContext([page], config, paths);
		const results = seoMeta.analyze(ctx);
		const codes = results.filter((r) => !r.pass).map((r) => r.issue?.code);
		assert.ok(
			codes.includes('description_too_short'),
			`Expected description_too_short, got: ${JSON.stringify(codes)}`,
		);
	});

	it('description of 70 chars does NOT fire description_too_short', async () => {
		const okDesc = 'A'.repeat(70);
		const page = makeHtmlPage('A title long enough', okDesc, '/');
		const ctx = await buildSiteContext([page], config, paths);
		const results = seoMeta.analyze(ctx);
		const codes = results.filter((r) => !r.pass).map((r) => r.issue?.code);
		assert.ok(
			!codes.includes('description_too_short'),
			`Should not fire at 70 chars, got: ${JSON.stringify(codes)}`,
		);
	});
});

describe('buildSiteContext', () => {
	it('builds context with tfidf and linkGraph', async () => {
		const pages = [makePage('/'), makePage('/about/')];
		const config = { name: 'Test', url: 'https://test.com', language: 'en' };
		const paths = {
			root: '/tmp/test',
			siteJson: '/tmp/test/site.json',
			domainMd: '/tmp/test/DOMAIN.md',
			personaMd: '/tmp/test/PERSONA.md',
			assets: '/tmp/test/assets',
			templates: '/tmp/test/templates',
			content: '/tmp/test/content',
			data: '/tmp/test/data',
			dist: '/tmp/test/dist',
			buildManifest: '/tmp/test/.build-manifest.json',
			fitnessHistory: '/tmp/test/.fitness-history.json',
		};
		const ctx = await buildSiteContext(pages, config, paths);
		assert.equal(ctx.pages.length, 2);
		assert.ok(ctx.tfidf.vectors.has('/'));
		assert.ok(ctx.tfidf.vectors.has('/about/'));
		assert.ok(ctx.pageSet.has('/'));
		assert.ok(ctx.pageSet.has('/about/'));
		assert.equal(ctx.sitemapXml, ''); // no dist/ in tmp
		assert.equal(ctx.robotsTxt, '');
	});
});

// ---------------------------------------------------------------------------
// Integration: fitness() on scaffolded project
// ---------------------------------------------------------------------------

describe('fitness — integration', () => {
	it('runs on scaffolded project without throwing', async () => {
		await withTmpDir(async (dir) => {
			await scaffold(dir, { name: 'Fitness Test', url: 'https://fitness.test' });
			const buildResult = await build(dir);
			assert.ok(buildResult.pages.length >= 2);

			const config = { name: 'Fitness Test', url: 'https://fitness.test', language: 'en' };
			const { join } = await import('node:path');
			const paths = {
				root: dir,
				siteJson: join(dir, 'site.json'),
				domainMd: join(dir, 'DOMAIN.md'),
				personaMd: join(dir, 'PERSONA.md'),
				assets: join(dir, 'assets'),
				templates: join(dir, 'templates'),
				content: join(dir, 'content'),
				data: join(dir, 'data'),
				dist: join(dir, 'dist'),
				buildManifest: join(dir, '.build-manifest.json'),
				fitnessHistory: join(dir, '.fitness-history.json'),
			};

			const report = await fitness(buildResult.pages, config, paths);

			// Report shape
			assert.ok(typeof report.overall === 'number');
			assert.ok(report.overall >= 0 && report.overall <= 100);
			assert.ok(typeof report.timestamp === 'number');
			assert.ok(report.timestamp > 0);

			// Dimensions present
			assert.ok(typeof report.dimensions === 'object');
			const dimKeys = Object.keys(report.dimensions);
			assert.ok(dimKeys.length > 0, 'at least one dimension');
			assert.ok(dimKeys.includes('seo_meta'), 'seo_meta dimension present');
			assert.ok(dimKeys.includes('technical'), 'technical dimension present');
			assert.ok(dimKeys.includes('content_quality'), 'content_quality dimension present');

			// Each dimension has the right shape
			for (const [, dim] of Object.entries(report.dimensions)) {
				assert.ok(dim.score >= 0 && dim.score <= 100);
				assert.ok(dim.passed >= 0);
				assert.ok(dim.failed >= 0);
				assert.ok(Array.isArray(dim.issues));
			}

			// Page scores
			assert.ok(typeof report.pages === 'object');
			const pageKeys = Object.keys(report.pages);
			assert.ok(pageKeys.length >= 2, 'at least 2 page scores');
			for (const [, ps] of Object.entries(report.pages)) {
				assert.ok(ps.score >= 0 && ps.score <= 100);
				assert.ok(Array.isArray(ps.issues));
				assert.ok(ps.wordCount >= 0);
				assert.ok(Array.isArray(ps.tfidfTopTerms));
			}

			// Clusters array (may be empty for tiny sites)
			assert.ok(Array.isArray(report.clusters));

			// Cannibalization array
			assert.ok(Array.isArray(report.cannibalization));
		});
	});

	it('overall score is 0-100', async () => {
		await withTmpDir(async (dir) => {
			await scaffold(dir, { name: 'Score Test', url: 'https://score.test' });
			const buildResult = await build(dir);
			const config = { name: 'Score Test', url: 'https://score.test', language: 'en' };
			const { join } = await import('node:path');
			const paths = {
				root: dir,
				siteJson: join(dir, 'site.json'),
				domainMd: join(dir, 'DOMAIN.md'),
				personaMd: join(dir, 'PERSONA.md'),
				assets: join(dir, 'assets'),
				templates: join(dir, 'templates'),
				content: join(dir, 'content'),
				data: join(dir, 'data'),
				dist: join(dir, 'dist'),
				buildManifest: join(dir, '.build-manifest.json'),
				fitnessHistory: join(dir, '.fitness-history.json'),
			};
			const report = await fitness(buildResult.pages, config, paths);
			assert.ok(report.overall >= 0);
			assert.ok(report.overall <= 100);
		});
	});
});
