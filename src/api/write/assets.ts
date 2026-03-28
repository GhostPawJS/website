import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { SiteError } from '../../errors.ts';
import { readFile } from '../../fs/read_file.ts';
import { writeFile } from '../../fs/write_file.ts';
import { resolvePaths } from '../../project/paths.ts';

/**
 * Create or update an asset file.
 * `assetPath` is relative to the `assets/` directory (e.g. `"css/style.css"`).
 * `content` can be a UTF-8 string or a Buffer for binary files.
 */
export async function writeAsset(
	dir: string,
	assetPath: string,
	content: string | Buffer,
): Promise<void> {
	validateAssetPath(assetPath);
	const paths = resolvePaths(dir);
	await writeFile(join(paths.assets, assetPath), content);
}

/**
 * Delete an asset file.
 * Throws `SiteError('not_found')` if the file does not exist.
 */
export async function deleteAsset(dir: string, assetPath: string): Promise<void> {
	validateAssetPath(assetPath);
	const paths = resolvePaths(dir);
	const absPath = join(paths.assets, assetPath);
	await readFile(absPath); // throws not_found if missing
	try {
		await rm(absPath);
	} catch (err) {
		const e = err as NodeJS.ErrnoException;
		throw new SiteError('io', `Failed to delete asset "${assetPath}": ${e.message}`);
	}
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validateAssetPath(assetPath: string): void {
	if (!assetPath || assetPath.includes('..') || assetPath.startsWith('/')) {
		throw new SiteError('validation', `Invalid asset path: "${assetPath}"`);
	}
}
