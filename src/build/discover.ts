import { isSiteError } from '../errors.ts';
import type { WalkEntry } from '../fs/walk.ts';
import { walk } from '../fs/walk.ts';

export interface DiscoveredFiles {
	/** All .md files in content/, relative to content dir. */
	contentFiles: WalkEntry[];
	/** All .html files in templates/, relative to templates dir. */
	templateFiles: WalkEntry[];
	/** All files in assets/, relative to assets dir. */
	assetFiles: WalkEntry[];
	/** All .json files in data/, relative to data dir. */
	dataFiles: WalkEntry[];
}

/**
 * Discover all source files in a project layout.
 * Directories that don't exist are treated as empty (no error thrown).
 */
export async function discoverFiles(
	contentDir: string,
	templatesDir: string,
	assetsDir: string,
	dataDir: string,
): Promise<DiscoveredFiles> {
	const [contentFiles, templateFiles, assetFiles, dataFiles] = await Promise.all([
		collectEntries(contentDir, (e) => e.relative.endsWith('.md')),
		collectEntries(templatesDir, (e) => e.relative.endsWith('.html')),
		collectEntries(assetsDir),
		collectEntries(dataDir, (e) => e.relative.endsWith('.json')),
	]);
	return { contentFiles, templateFiles, assetFiles, dataFiles };
}

async function collectEntries(
	dir: string,
	filter?: (e: WalkEntry) => boolean,
): Promise<WalkEntry[]> {
	const entries: WalkEntry[] = [];
	try {
		for await (const e of walk(dir, filter)) {
			entries.push(e);
		}
	} catch (err) {
		if (isSiteError(err) && err.code === 'not_found') return entries;
		const e = err as NodeJS.ErrnoException;
		if (e.code === 'ENOENT') return entries;
		throw err;
	}
	return entries;
}
