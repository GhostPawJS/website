import { copyFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { SiteError } from '../errors.ts';
import { walk } from './walk.ts';

/**
 * Recursively copy all files from `src` to `dest`, preserving relative paths.
 * Creates destination directories as needed. If `src` does not exist this is
 * a no-op (returns 0).
 *
 * @returns Number of files copied.
 */
export async function copyDir(src: string, dest: string): Promise<number> {
	let count = 0;
	try {
		for await (const entry of walk(src)) {
			const destPath = join(dest, entry.relative);
			const slashIdx = entry.relative.lastIndexOf('/');
			// Always ensure the destination directory exists (either a subdir or dest itself)
			const destDir = slashIdx > 0 ? join(dest, entry.relative.slice(0, slashIdx)) : dest;
			await mkdir(destDir, { recursive: true });
			await copyFile(entry.path, destPath);
			count++;
		}
	} catch (err) {
		const e = err as NodeJS.ErrnoException;
		if (e.code === 'ENOENT' && count === 0) {
			// src doesn't exist — treat as empty
			return 0;
		}
		throw new SiteError('io', `Failed to copy "${src}" → "${dest}": ${e.message}`);
	}
	return count;
}
