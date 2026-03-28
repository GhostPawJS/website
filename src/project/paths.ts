import { join } from 'node:path';
import type { ProjectPaths } from '../types.ts';

/**
 * Derive all canonical project paths from a single root directory.
 * Pure computation — no I/O.
 */
export function resolvePaths(root: string): ProjectPaths {
	return {
		root,
		siteJson: join(root, 'site.json'),
		domainMd: join(root, 'DOMAIN.md'),
		personaMd: join(root, 'PERSONA.md'),
		assets: join(root, 'assets'),
		templates: join(root, 'templates'),
		content: join(root, 'content'),
		data: join(root, 'data'),
		dist: join(root, 'dist'),
		buildManifest: join(root, '.build-manifest.json'),
		fitnessHistory: join(root, '.fitness-history.json'),
	};
}
