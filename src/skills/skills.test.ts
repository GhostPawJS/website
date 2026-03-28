// ---------------------------------------------------------------------------
// Skills layer tests
// ---------------------------------------------------------------------------

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { contentCannibalization } from './content_cannibalization.ts';
import { createPageWell } from './create_page_well.ts';
import { geoOptimization } from './geo_optimization.ts';
import { SKILLS } from './index.ts';
import { searchConsoleWorkflow } from './search_console_workflow.ts';
import { seoChecklist } from './seo_checklist.ts';
import { siteLaunchChecklist } from './site_launch_checklist.ts';
import { templateComposition } from './template_composition.ts';

describe('SKILLS registry', () => {
	it('contains exactly 7 skills', () => {
		assert.equal(SKILLS.length, 7);
	});

	it('all skills have required string fields', () => {
		for (const skill of SKILLS) {
			assert.ok(skill.name, `skill missing name`);
			assert.ok(skill.description, `${skill.name} missing description`);
			assert.ok(skill.whenToUse, `${skill.name} missing whenToUse`);
			assert.ok(skill.content, `${skill.name} missing content`);
		}
	});

	it('all skill names are kebab-case', () => {
		for (const skill of SKILLS) {
			assert.match(skill.name, /^[a-z][a-z0-9-]*$/, `${skill.name} is not kebab-case`);
		}
	});

	it('no two skills have the same name', () => {
		const names = SKILLS.map((s) => s.name);
		const unique = new Set(names);
		assert.equal(unique.size, names.length);
	});

	it('content is non-trivially long markdown', () => {
		for (const skill of SKILLS) {
			assert.ok(
				skill.content.length > 200,
				`${skill.name} content is too short (${skill.content.length} chars)`,
			);
		}
	});
});

describe('individual skills', () => {
	it('createPageWell teaches layout: (not template:) as the canonical field', () => {
		assert.ok(createPageWell.content.includes('layout:'), 'must teach layout: field');
		assert.ok(createPageWell.content.includes('title'));
		assert.ok(createPageWell.content.includes('description'));
		// Must NOT teach template: as the primary layout field
		assert.ok(
			!createPageWell.content.includes('template: page'),
			'must not teach "template: page" — correct field is "layout: page.html"',
		);
	});

	it('createPageWell teaches og_image: as the canonical OG image field', () => {
		assert.ok(createPageWell.content.includes('og_image:'), 'must teach og_image: field');
	});

	it('createPageWell description length range matches actual thresholds (70–165)', () => {
		assert.ok(createPageWell.content.includes('70–165'), 'description range must be 70–165');
	});

	it('seoChecklist mentions key fitness codes', () => {
		assert.ok(seoChecklist.content.includes('title_too_long'));
		assert.ok(seoChecklist.content.includes('canonical_missing'));
		assert.ok(seoChecklist.content.includes('h1_missing'));
	});

	it('seoChecklist description length range matches actual thresholds (70–165)', () => {
		assert.ok(seoChecklist.content.includes('70–165'), 'seo_checklist range must be 70–165');
	});

	it('seoChecklist teaches og_image: in frontmatter examples', () => {
		assert.ok(seoChecklist.content.includes('og_image:'), 'must use og_image: field in examples');
	});

	it('geoOptimization references AI bots', () => {
		assert.ok(geoOptimization.content.includes('GPTBot'));
		assert.ok(geoOptimization.content.includes('ClaudeBot'));
		assert.ok(geoOptimization.content.includes('PerplexityBot'));
	});

	it('templateComposition explains triple-brace syntax', () => {
		assert.ok(templateComposition.content.includes('{{{'));
	});

	it('templateComposition teaches layout: (not template:) for building-block templates', () => {
		assert.ok(
			templateComposition.content.includes('layout: faq.html'),
			'must teach layout: faq.html',
		);
		assert.ok(
			templateComposition.content.includes('layout: table.html'),
			'must teach layout: table.html',
		);
		assert.ok(
			!templateComposition.content.includes('template: faq'),
			'must not teach "template: faq"',
		);
	});

	it('templateComposition teaches correct data variable path (data.nav)', () => {
		assert.ok(
			templateComposition.content.includes('data.nav'),
			'must reference data files under data. namespace',
		);
		assert.ok(
			templateComposition.content.includes('{{#each data.nav as item}}'),
			'must show correct each loop syntax with data. prefix',
		);
	});

	it('templateComposition uses #each/#if syntax (not Mustache # sections)', () => {
		assert.ok(templateComposition.content.includes('{{#each'), 'must use {{#each syntax');
		assert.ok(templateComposition.content.includes('{{#if'), 'must use {{#if syntax');
		assert.ok(
			!templateComposition.content.includes('{{ #'),
			'must not use Mustache {{ # section syntax',
		);
	});

	it('siteLaunchChecklist includes score targets', () => {
		assert.ok(siteLaunchChecklist.content.includes('seo_meta'));
		assert.ok(siteLaunchChecklist.content.includes('≥ 80'));
	});

	it('contentCannibalization explains similarity thresholds', () => {
		assert.ok(contentCannibalization.content.includes('0.7'));
		assert.ok(contentCannibalization.content.includes('cannibalization'));
	});

	it('searchConsoleWorkflow documents all 4 issue types', () => {
		assert.ok(searchConsoleWorkflow.content.includes('low_ctr'));
		assert.ok(searchConsoleWorkflow.content.includes('keyword_opportunity'));
		assert.ok(searchConsoleWorkflow.content.includes('content_gap'));
		assert.ok(searchConsoleWorkflow.content.includes('url_flickering'));
	});
});
