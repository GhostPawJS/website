import { SiteError } from '../errors.ts';
import { readFile } from '../fs/read_file.ts';
import { writeFile } from '../fs/write_file.ts';
import type { SiteConfig } from '../types.ts';

/**
 * Load and validate `site.json` from `filePath`.
 * Throws `SiteError('not_found')` if the file is missing.
 * Throws `SiteError('validation')` if required fields are absent or malformed.
 */
export async function loadSiteConfig(filePath: string): Promise<SiteConfig> {
	const raw = await readFile(filePath);
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		throw new SiteError('validation', `site.json is not valid JSON: "${filePath}"`);
	}
	return validateSiteConfig(parsed, filePath);
}

function validateSiteConfig(raw: unknown, filePath: string): SiteConfig {
	if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
		throw new SiteError('validation', `site.json must be a JSON object: "${filePath}"`);
	}
	const obj = raw as Record<string, unknown>;

	for (const field of ['name', 'url', 'language'] as const) {
		if (typeof obj[field] !== 'string' || (obj[field] as string).trim() === '') {
			throw new SiteError(
				'validation',
				`site.json missing required string field "${field}": "${filePath}"`,
			);
		}
	}

	return obj as SiteConfig;
}

/**
 * Write `config` to `filePath` as pretty-printed JSON.
 */
export async function writeSiteConfig(filePath: string, config: SiteConfig): Promise<void> {
	await writeFile(filePath, `${JSON.stringify(config, null, '\t')}\n`);
}

/**
 * Minimal default site.json for scaffold.
 */
export function defaultSiteConfig(name: string): SiteConfig {
	return {
		name,
		url: 'http://localhost:3000',
		language: 'en',
	};
}
