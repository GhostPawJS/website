import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolvePaths } from '../../project/paths.ts';
import { withTmpDir } from '../../test_utils.ts';
import type { RenderedPage } from '../../types.ts';
import { buildSiteContext } from '../context.ts';
import type { Analyzer, SiteContext } from '../types.ts';
import { contentQuality } from './content_quality.ts';
import { eeat } from './eeat.ts';
import { images } from './images.ts';
import { links } from './links.ts';
import { schemaValidation } from './schema_validation.ts';
import { seoStructure } from './seo_structure.ts';
import { social } from './social.ts';
import { technical } from './technical.ts';

function page(
	html: string,
	frontmatter: RenderedPage['frontmatter'] = {},
	url = '/',
): RenderedPage {
	return {
		html,
		frontmatter,
		url,
		file: 'content/index.md',
		slug: url === '/' ? 'index' : url.slice(1, -1),
		textContent: 'A clear useful explanation. '.repeat(80),
		wordCount: 320,
	};
}
async function context(pages: RenderedPage[], fn: (ctx: SiteContext) => void) {
	await withTmpDir(async (dir) =>
		fn(
			await buildSiteContext(
				pages,
				{ name: 'Quality', url: 'https://example.com', language: 'en' },
				resolvePaths(dir),
			),
		),
	);
}
function codes(analyzer: Analyzer, ctx: SiteContext): string[] {
	return analyzer.analyze(ctx).flatMap((result) => (result.pass ? [] : [result.issue.code]));
}
function includes(actual: string[], expected: string[]) {
	for (const code of expected)
		assert.ok(actual.includes(code), `Missing ${code}: ${actual.join(', ')}`);
}

describe('quality analyzer diagnostics', () => {
	it('finds image accessibility and format problems while accepting decorative and modern images', async () => {
		await context(
			[
				page('<p>No images</p>'),
				page(
					'<img src="photo.jpg"><img src="Bad Name.bmp" alt="IMG_1234"><img src="photo.png" alt="IMG_1234"><img src="icon.svg" alt="" width="20" height="20"><img src="view.avif" alt="View" width="100" height="50"><img src="image?id=2" alt="Remote" width="100" height="50">',
				),
			],
			(ctx) => {
				assert.equal(images.applies(ctx), true);
				includes(codes(images, ctx), [
					'img_alt_missing',
					'img_alt_filename_like',
					'img_alt_duplicate',
					'img_dimensions_missing',
					'img_legacy_format',
					'img_filename_not_descriptive',
				]);
			},
		);
		await context(
			[page('<img src="view.webp" alt="A mountain view" width="100" height="50">')],
			(ctx) => assert.deepEqual(codes(images, ctx), []),
		);
		await context([page('No images')], (ctx) => assert.equal(images.applies(ctx), false));
	});
	it('reports missing social metadata and a divergent social title', async () => {
		await context([page('<title>Article</title>')], (ctx) =>
			includes(codes(social, ctx), [
				'og_missing_og_title',
				'og_missing_og_description',
				'og_missing_og_url',
				'og_missing_og_type',
				'og_missing_og_image',
				'twitter_card_missing',
				'twitter_title_missing',
			]),
		);
		const meta =
			'<meta property="og:description" content="Description"><meta property="og:url" content="https://example.com"><meta property="og:type" content="website"><meta property="og:image" content="/image.webp"><meta name="twitter:card" content="summary"><meta name="twitter:title" content="Article">';
		await context(
			[
				page(
					`<title>A very long article title about mountain exploration and travel</title><meta property="og:title" content="Short title">${meta}`,
				),
			],
			(ctx) => assert.deepEqual(codes(social, ctx), ['og_title_mismatch']),
		);
		await context(
			[page(`<title>Article</title><meta property="og:title" content="Article">${meta}`)],
			(ctx) => assert.deepEqual(codes(social, ctx), []),
		);
	});
	it('reports technical problems without treating JSON-LD as a body script', async () => {
		await context(
			[
				page(
					'<body><div id="x"></div><div id="x"></div><style>p{color:red}</style><script>run()</script></body>',
				),
			],
			(ctx) =>
				assert.deepEqual(codes(technical, ctx), [
					'missing_doctype',
					'duplicate_ids',
					'inline_styles',
					'inline_scripts',
				]),
		);
		await context(
			[page('<!DOCTYPE html><body><script type="application/ld+json">{}</script></body>')],
			(ctx) => assert.deepEqual(codes(technical, ctx), []),
		);
	});
	it('checks heading hierarchy, keyword use, and URL slugs', async () => {
		await context([page('<p>No heading</p>')], (ctx) =>
			includes(codes(seoStructure, ctx), ['h1_missing']),
		);
		await context(
			[
				page(
					'<h1>Title</h1><h1>Another</h1><h3>Introduction</h3>',
					{ keyword: 'mountains' },
					'/Bad_Slug/',
				),
			],
			(ctx) =>
				includes(codes(seoStructure, ctx), [
					'h1_multiple',
					'h1_keyword_missing',
					'heading_hierarchy_skipped',
					'heading_generic',
					'url_slug_invalid',
				]),
		);
		await context(
			[
				page(
					'<h1>Mountain guide</h1><h2>Climbing safely</h2>',
					{ keyword: 'mountain' },
					'/mountain-guide/',
				),
			],
			(ctx) => assert.deepEqual(codes(seoStructure, ctx), []),
		);
		await context([page('<h1>Mountain guide</h1>', {}, '/mountain--guide/')], (ctx) =>
			includes(codes(seoStructure, ctx), ['url_slug_double_hyphen']),
		);
	});
	it('distinguishes broken links, self links, generic anchors, and unsafe external links', async () => {
		await context(
			[
				page(
					'<a href="/missing/">click here</a><a href="/">Self</a><a href="https://other.example" target="_blank">Other</a><a href="mailto:a@example.com">Mail</a><a href="#section">Jump</a><a href="/file.pdf">PDF</a>',
				),
				page('<h1>Orphan</h1>', {}, '/orphan/'),
			],
			(ctx) =>
				includes(codes(links, ctx), [
					'broken_internal_link',
					'self_referential_link',
					'anchor_text_generic',
					'external_link_no_noopener',
					'page_orphan',
					'crawl_depth_exceeded',
				]),
		);
		await context(
			[
				page(
					'<a href="/guide/">Mountain guide</a><a href="https://other.example" target="_blank" rel="noopener">Other source</a>',
				),
				page('<a href="/">Home</a>', {}, '/guide/'),
			],
			(ctx) => assert.deepEqual(codes(links, ctx), []),
		);
	});
	it('validates structured data and FAQ entries', async () => {
		const ld = (value: unknown) =>
			`<script type="application/ld+json">${JSON.stringify(value)}</script>`;
		await context(
			[
				page(
					ld('invalid') +
						ld({ name: 'No type' }) +
						ld({ '@type': 'Article' }) +
						ld({ '@type': 'FAQPage', mainEntity: [null, { name: 'Incomplete' }] }),
				),
			],
			(ctx) => {
				assert.equal(schemaValidation.applies(ctx), true);
				includes(codes(schemaValidation, ctx), [
					'schema_not_object',
					'schema_no_type',
					'schema_missing_property',
					'faq_item_incomplete',
				]);
			},
		);
		await context(
			[
				page(
					ld({
						'@type': 'FAQPage',
						mainEntity: [
							{ name: 'Question', acceptedAnswer: { '@type': 'Answer', text: 'Answer' } },
						],
					}),
				),
			],
			(ctx) => assert.deepEqual(codes(schemaValidation, ctx), []),
		);
	});
	it('checks authorship, publication dates, and article descriptions', async () => {
		await context([page('<title>Brief</title>', { layout: 'post.html' })], (ctx) => {
			assert.equal(eeat.applies(ctx), true);
			includes(codes(eeat, ctx), [
				'missing_author',
				'missing_date',
				'title_too_short_for_eeat',
				'missing_description_eeat',
			]);
		});
		await context(
			[
				page(
					'<title>A detailed mountain guide</title><meta name="author" content="Writer"><meta property="article:published_time" content="2026-10-24"><meta name="description" content="A practical guide">',
					{ layout: 'post.html', date: '2026-10-24' },
				),
			],
			(ctx) => assert.deepEqual(codes(eeat, ctx), []),
		);
	});
	it('finds thin, stale, dense, and difficult prose', async () => {
		const thin = page('<p>Brief</p>');
		thin.wordCount = 2;
		thin.textContent = 'Very brief.';
		const dense = page(
			`<p>${'Institutionalization contextualization characterization. '.repeat(500)}</p>`,
			{ dateModified: '2000-01-01' },
		);
		dense.textContent = `${'Institutionalization contextualization characterization '.repeat(150)}.`;
		await context([thin, dense], (ctx) =>
			includes(codes(contentQuality, ctx), [
				'word_count_low',
				'content_stale_critical',
				'paragraph_density_high',
				'readability_low',
				'gunning_fog_high',
			]),
		);
	});
});
