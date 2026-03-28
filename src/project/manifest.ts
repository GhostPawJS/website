import { stat } from 'node:fs/promises';
import { isSiteError } from '../errors.ts';
import { hashContent } from '../fs/hash_file.ts';
import { readFile } from '../fs/read_file.ts';
import { writeFile } from '../fs/write_file.ts';
import type { BuildManifest } from '../types.ts';

const MANIFEST_VERSION = 1 as const;

export function emptyManifest(): BuildManifest {
	return { version: MANIFEST_VERSION, timestamp: Date.now(), sourceFingerprint: '', pages: {} };
}

/**
 * Compute a fingerprint for the template + data source files.
 * Sorts paths for stability, then hashes "path:mtime\n" pairs.
 * A change to any template or data file changes this value.
 */
export async function computeSourceFingerprint(filePaths: string[]): Promise<string> {
	const sorted = [...filePaths].sort();
	const parts: string[] = [];
	for (const p of sorted) {
		let mtime = 0;
		try {
			const s = await stat(p);
			mtime = s.mtimeMs;
		} catch {
			// Missing file contributes mtime=0; still included so additions are detected.
		}
		parts.push(`${p}:${mtime}`);
	}
	return hashContent(parts.join('\n'));
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
