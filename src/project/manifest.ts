import { isSiteError } from '../errors.ts';
import { readFile } from '../fs/read_file.ts';
import { writeFile } from '../fs/write_file.ts';
import type { BuildManifest } from '../types.ts';

const MANIFEST_VERSION = 1 as const;

export function emptyManifest(): BuildManifest {
	return { version: MANIFEST_VERSION, timestamp: Date.now(), pages: {} };
}

/**
 * Load `.build-manifest.json`. Returns an empty manifest if missing or
 * corrupt (so builds can always continue).
 */
export async function loadManifest(filePath: string): Promise<BuildManifest> {
	try {
		const raw = await readFile(filePath);
		const parsed = JSON.parse(raw) as BuildManifest;
		if (parsed.version !== MANIFEST_VERSION) return emptyManifest();
		return parsed;
	} catch (err) {
		if (isSiteError(err) && err.code === 'not_found') return emptyManifest();
		// Corrupt JSON — start fresh
		return emptyManifest();
	}
}

export async function saveManifest(filePath: string, manifest: BuildManifest): Promise<void> {
	await writeFile(filePath, `${JSON.stringify(manifest, null, '\t')}\n`);
}
