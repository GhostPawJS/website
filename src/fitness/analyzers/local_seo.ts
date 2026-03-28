// ---------------------------------------------------------------------------
// Analyzer: local_seo — Local business SEO signals
//
// Checks NAP completeness, opening hours, geo coordinates, telephone links,
// and restaurant-specific schema properties. Applies only when LocalBusiness
// (or subtype) JSON-LD is detected.
// ---------------------------------------------------------------------------

import { getJsonLd } from '../html_parser.ts';
import type { Analyzer, CheckResult, SiteContext } from '../types.ts';
import { fail, pass } from '../types.ts';

const DIMENSION = 'local_seo';

const LOCAL_BUSINESS_TYPES =
	/LocalBusiness|Restaurant|Dentist|Hotel|Store|Salon|Bakery|Bar|Cafe|Gym|Hospital|MedicalBusiness|RealEstateAgent|AutoDealer|Beauty/i;

function isLocalBusinessSchema(ld: unknown): ld is Record<string, unknown> {
	if (typeof ld !== 'object' || ld === null) return false;
	const obj = ld as Record<string, unknown>;
	return LOCAL_BUSINESS_TYPES.test(String(obj['@type'] ?? ''));
}

export const localSeo: Analyzer = {
	id: 'local_seo',
	dimension: DIMENSION,
	weight: 10,
	applies: (ctx) =>
		ctx.pages.some((p) => getJsonLd(p.html).some((ld) => isLocalBusinessSchema(ld))),

	analyze(ctx: SiteContext): CheckResult[] {
		const results: CheckResult[] = [];

		// Collect NAP data for consistency check across all pages
		const napEntries: Array<{ name: string; address: string; page: string }> = [];

		for (const page of ctx.pages) {
			const { url, html } = page;
			const schemas = getJsonLd(html);
			const localSchemas = schemas.filter(isLocalBusinessSchema);

			if (localSchemas.length === 0) continue;

			for (const schema of localSchemas) {
				const typeStr = String(schema['@type'] ?? '');

				// 1. nap_completeness — name, address, telephone
				const missingNap: string[] = [];
				if (!schema.name) missingNap.push('name');
				if (!schema.address) missingNap.push('address');
				if (!schema.telephone) missingNap.push('telephone');

				if (missingNap.length > 0) {
					results.push(
						fail({
							severity: 'error',
							dimension: DIMENSION,
							code: 'missing_nap',
							message: `Local business schema on "${url}" is missing NAP field(s): ${missingNap.join(', ')} — NAP completeness is critical for local SEO.`,
							page: url,
							element: typeStr,
							expected: 'name, address, telephone',
							fix: {
								file: page.file,
								action: 'set_frontmatter',
								...(missingNap[0] ? { field: missingNap[0] } : {}),
							},
						}),
					);
				} else {
					results.push(pass);
					// Record for NAP consistency check
					const addressStr =
						typeof schema.address === 'object' && schema.address !== null
							? JSON.stringify(schema.address)
							: String(schema.address ?? '');
					napEntries.push({
						name: String(schema.name),
						address: addressStr,
						page: url,
					});
				}

				// 2. opening_hours
				const hasHours =
					schema.openingHoursSpecification !== undefined || schema.openingHours !== undefined;
				if (!hasHours) {
					results.push(
						fail({
							severity: 'warning',
							dimension: DIMENSION,
							code: 'missing_opening_hours',
							message: `Local business schema on "${url}" has no opening hours — add openingHours or openingHoursSpecification for rich results.`,
							page: url,
							element: typeStr,
							fix: { file: page.file, action: 'set_frontmatter', field: 'openingHours' },
						}),
					);
				} else {
					results.push(pass);
				}

				// 3. geo_coordinates
				const hasGeo =
					schema.geo !== undefined || schema.hasMap !== undefined || schema.latitude !== undefined;
				if (!hasGeo) {
					results.push(
						fail({
							severity: 'info',
							dimension: DIMENSION,
							code: 'missing_geo_coordinates',
							message: `Local business schema on "${url}" has no geo coordinates — add "geo" with latitude/longitude for map integration.`,
							page: url,
							element: typeStr,
							fix: { file: page.file, action: 'set_frontmatter', field: 'geo' },
						}),
					);
				} else {
					results.push(pass);
				}

				// 4. telephone_link — check HTML for <a href="tel:
				const hasTelLink = html.includes('<a href="tel:') || html.includes("<a href='tel:");
				if (!hasTelLink) {
					results.push(
						fail({
							severity: 'info',
							dimension: DIMENSION,
							code: 'no_tel_link',
							message: `Page "${url}" has no clickable telephone link (<a href="tel:...">) — tap-to-call links improve mobile UX and local SEO.`,
							page: url,
							fix: { file: page.file, action: 'update_content' },
						}),
					);
				} else {
					results.push(pass);
				}

				// 5. restaurant_specific
				if (/Restaurant/i.test(typeStr)) {
					const restaurantFields: Array<keyof typeof schema> = [
						'menu',
						'servesCuisine',
						'priceRange',
					];
					for (const field of restaurantFields) {
						if (!schema[field]) {
							results.push(
								fail({
									severity: 'warning',
									dimension: DIMENSION,
									code: 'restaurant_missing_field',
									message: `Restaurant schema on "${url}" is missing "${field}" — this property improves restaurant rich results.`,
									page: url,
									element: typeStr,
									expected: `"${field}" property`,
									fix: { file: page.file, action: 'set_frontmatter', field: String(field) },
								}),
							);
						} else {
							results.push(pass);
						}
					}
				}
			}
		}

		// NAP consistency — all pages should have the same name + address
		if (napEntries.length > 1) {
			const firstName = napEntries[0]?.name ?? '';
			const firstAddress = napEntries[0]?.address ?? '';
			for (let i = 1; i < napEntries.length; i++) {
				const entry = napEntries[i] as (typeof napEntries)[0];
				if (entry.name !== firstName || entry.address !== firstAddress) {
					results.push(
						fail({
							severity: 'error',
							dimension: DIMENSION,
							code: 'nap_inconsistent',
							message: `NAP inconsistency detected: "${entry.page}" has different name/address than "${napEntries[0]?.page ?? ''}" — consistent NAP is critical for local SEO.`,
							page: entry.page,
							current: `${entry.name} / ${entry.address}`,
							expected: `${firstName} / ${firstAddress}`,
						}),
					);
				} else {
					results.push(pass);
				}
			}
		}

		return results;
	},
};
