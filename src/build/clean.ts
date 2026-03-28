import { mkdir, rm } from 'node:fs/promises';
import { SiteError } from '../errors.ts';

/**
 * Delete `distDir` and recreate it as an empty directory.
 * If `distDir` does not exist, this is a no-op (no error thrown).
 */
export async function cleanDist(distDir: string): Promise<void> {
	try {
		await rm(distDir, { recursive: true, force: true });
		await mkdir(distDir, { recursive: true });
	} catch (err) {
		const e = err as NodeJS.ErrnoException;
		throw new SiteError('io', `Failed to clean dist directory "${distDir}": ${e.message}`);
	}
}
