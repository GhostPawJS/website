// ---------------------------------------------------------------------------
// Analyzer: schema_validation — JSON-LD structured data correctness
// Applies only to pages that have JSON-LD script blocks.
// Checks required properties per @type.
// ---------------------------------------------------------------------------

import { getJsonLd } from '../html_parser.ts';
import type { Analyzer, CheckResult, SiteContext } from '../types.ts';
import { fail, pass } from '../types.ts';

const DIMENSION = 'schema_validation';

// Required properties per @type
const REQUIRED_PROPS: Record<string, string[]> = {
	Article: ['headline', 'author', 'datePublished'],
	BlogPosting: ['headline', 'author', 'datePublished'],
	FAQPage: ['mainEntity'],
	LocalBusiness: ['name', 'address', 'telephone'],
	Restaurant: ['name', 'address', 'telephone', 'servesCuisine'],
	Product: ['name', 'offers'],
	WebSite: ['name', 'url'],
	BreadcrumbList: ['itemListElement'],
	Person: ['name'],
	Organization: ['name'],
};

export const schemaValidation: Analyzer = {
	id: 'schema_validation',
	dimension: DIMENSION,
	weight: 8,
	applies: (ctx) => ctx.pages.some((p) => getJsonLd(p.html).length > 0),

	analyze(ctx: SiteContext): CheckResult[] {
		const results: CheckResult[] = [];

		for (const page of ctx.pages) {
			const { url, html } = page;
			const schemas = getJsonLd(html);
			if (schemas.length === 0) continue;

			for (const schema of schemas) {
				if (typeof schema !== 'object' || schema === null) {
					results.push(
						fail({
							severity: 'error',
							dimension: DIMENSION,
							code: 'schema_not_object',
							message: `JSON-LD block on "${url}" is not a JSON object.`,
							page: url,
						}),
					);
					continue;
				}

				const obj = schema as Record<string, unknown>;
				const type = obj['@type'];
				if (!type) {
					results.push(
						fail({
							severity: 'warning',
							dimension: DIMENSION,
							code: 'schema_no_type',
							message: `JSON-LD on "${url}" has no @type.`,
							page: url,
						}),
					);
					continue;
				}

				const typeStr = Array.isArray(type) ? type[0] : String(type);
				const required = REQUIRED_PROPS[typeStr] ?? [];
				let allPresent = true;

				for (const prop of required) {
					if (obj[prop] === undefined || obj[prop] === null || obj[prop] === '') {
						results.push(
							fail({
								severity: 'error',
								dimension: DIMENSION,
								code: 'schema_missing_property',
								message: `Schema @type "${typeStr}" on "${url}" is missing required property "${prop}".`,
								page: url,
								element: typeStr,
								expected: `"${prop}" property`,
								fix: { file: page.file, action: 'set_frontmatter', field: prop },
							}),
						);
						allPresent = false;
					}
				}
				if (allPresent) results.push(pass);

				// FAQPage: check mainEntity is array with name + acceptedAnswer
				if (typeStr === 'FAQPage') {
					const mainEntity = obj.mainEntity;
					if (Array.isArray(mainEntity)) {
						for (const item of mainEntity) {
							if (typeof item !== 'object' || item === null) continue;
							const q = item as Record<string, unknown>;
							if (!q.name || typeof q.acceptedAnswer !== 'object') {
								results.push(
									fail({
										severity: 'warning',
										dimension: DIMENSION,
										code: 'faq_item_incomplete',
										message: `FAQPage item on "${url}" is missing "name" or "acceptedAnswer".`,
										page: url,
									}),
								);
							} else {
								results.push(pass);
							}
						}
					}
				}
			}
		}

		return results;
	},
};
