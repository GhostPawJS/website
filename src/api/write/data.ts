import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { SiteError } from '../../errors.ts';
import { readFile } from '../../fs/read_file.ts';
import { writeFile } from '../../fs/write_file.ts';
import { resolvePaths } from '../../project/paths.ts';

/**
 * Create or update a data file.
 * `name` is the filename without extension (e.g. `"nav"` → `data/nav.json`).
 * `json` is any JSON-serializable value.
 */
export async function writeData(dir: string, name: string, json: unknown): Promise<void> {
	validateDataName(name);
	const paths = resolvePaths(dir);
	const absPath = join(paths.data, `${name}.json`);
	await writeFile(absPath, `${JSON.stringify(json, null, '\t')}\n`);
}

/**
 * Delete a data file.
 * Throws `SiteError('not_found')` if the file does not exist.
 */
export async function deleteData(dir: string, name: string): Promise<void> {
	validateDataName(name);
	const paths = resolvePaths(dir);
	const absPath = join(paths.data, `${name}.json`);
	await readFile(absPath); // throws not_found if missing
	try {
		await rm(absPath);
	} catch (err) {
		const e = err as NodeJS.ErrnoException;
		throw new SiteError('io', `Failed to delete data "${name}": ${e.message}`);
	}
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validateDataName(name: string): void {
	if (!name || name.includes('..') || name.includes('/') || /[<>:"|?*]/.test(name)) {
		throw new SiteError('validation', `Invalid data name: "${name}"`);
	}
}
