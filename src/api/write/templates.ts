import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { SiteError } from '../../errors.ts';
import { readFile } from '../../fs/read_file.ts';
import { writeFile } from '../../fs/write_file.ts';
import { resolvePaths } from '../../project/paths.ts';

/**
 * Create or update a template file.
 * `name` is the template filename (e.g. `"page.html"`).
 */
export async function writeTemplate(dir: string, name: string, html: string): Promise<void> {
	validateTemplateName(name);
	const paths = resolvePaths(dir);
	await writeFile(join(paths.templates, name), html);
}

/**
 * Delete a template file.
 * Throws `SiteError('not_found')` if the file does not exist.
 */
export async function deleteTemplate(dir: string, name: string): Promise<void> {
	validateTemplateName(name);
	const paths = resolvePaths(dir);
	const absPath = join(paths.templates, name);
	await readFile(absPath); // throws not_found if missing
	try {
		await rm(absPath);
	} catch (err) {
		const e = err as NodeJS.ErrnoException;
		throw new SiteError('io', `Failed to delete template "${name}": ${e.message}`);
	}
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validateTemplateName(name: string): void {
	if (!name || name.includes('..') || name.includes('/') || !name.endsWith('.html')) {
		throw new SiteError(
			'validation',
			`Invalid template name: "${name}". Must be a .html filename.`,
		);
	}
}
