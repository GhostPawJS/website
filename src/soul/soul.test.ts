// ---------------------------------------------------------------------------
// Soul layer tests
// ---------------------------------------------------------------------------

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { siteBuilderPersona } from './site_builder.ts';

describe('siteBuilderPersona', () => {
	it('has all required Persona fields', () => {
		assert.ok(siteBuilderPersona.slug);
		assert.ok(siteBuilderPersona.name);
		assert.ok(siteBuilderPersona.description);
		assert.ok(siteBuilderPersona.essence);
		assert.ok(Array.isArray(siteBuilderPersona.traits));
		assert.equal(typeof siteBuilderPersona.renderSoulPromptFoundation, 'function');
	});

	it('slug is kebab-case', () => {
		assert.match(siteBuilderPersona.slug, /^[a-z][a-z0-9-]*$/);
	});

	it('has a meaningful number of traits', () => {
		assert.ok(siteBuilderPersona.traits.length >= 10, 'Expected at least 10 traits');
	});

	it('renderSoulPromptFoundation returns a non-empty string', () => {
		const prompt = siteBuilderPersona.renderSoulPromptFoundation();
		assert.ok(typeof prompt === 'string');
		assert.ok(prompt.length > 200);
	});

	it('prompt foundation includes the core workflow', () => {
		const prompt = siteBuilderPersona.renderSoulPromptFoundation();
		assert.ok(prompt.includes('site_read'));
		assert.ok(prompt.includes('site_write'));
		assert.ok(prompt.includes('site_check'));
		assert.ok(prompt.includes('site_plan'));
	});

	it('prompt foundation includes the essence text', () => {
		const prompt = siteBuilderPersona.renderSoulPromptFoundation();
		assert.ok(prompt.includes('fitness system'));
	});

	it('all traits are non-empty strings', () => {
		for (const trait of siteBuilderPersona.traits) {
			assert.ok(typeof trait === 'string' && trait.length > 0, `Empty or non-string trait found`);
		}
	});

	it('essence mentions AI search', () => {
		assert.ok(
			siteBuilderPersona.essence.toLowerCase().includes('ai') ||
				siteBuilderPersona.essence.toLowerCase().includes('search'),
		);
	});
});
