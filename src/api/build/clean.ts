import { rm } from 'node:fs/promises';
import { resolvePaths } from '../../project/paths.ts';

/**
 * Remove `dist/` and `.build-manifest.json` from the project directory.
 * Safe to call on a project that has never been built.
 */
export async function clean(dir: string): Promise<void> {
	const paths = resolvePaths(dir);
	await Promise.all([
		rm(paths.dist, { recursive: true, force: true }),
		rm(paths.buildManifest, { force: true }),
	]);
}
