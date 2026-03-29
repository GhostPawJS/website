import { createReadStream, createWriteStream } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';

/**
 * Text file extensions that benefit from gzip compression.
 * Binary formats (png, jpg, webp, woff2) are already compressed — skip them.
 */
const COMPRESSIBLE = new Set([
	'.html',
	'.css',
	'.js',
	'.mjs',
	'.json',
	'.xml',
	'.svg',
	'.txt',
	'.webmanifest',
	'.map',
]);

/**
 * Walk `distDir` and write a `.gz` companion next to every compressible file.
 * Existing `.gz` files are overwritten. Skips files that are already `.gz`.
 *
 * Called by `website build` after the main build so the production server
 * can serve pre-compressed assets without runtime CPU cost.
 *
 * Returns the number of files compressed.
 */
export async function precompress(distDir: string): Promise<number> {
	let count = 0;
	const stack = [distDir];

	while (stack.length > 0) {
		// biome-ignore lint/style/noNonNullAssertion: guarded by length check above
		const dir = stack.pop()!;
		let entries: import('node:fs').Dirent<string>[];
		try {
			entries = await readdir(dir, { withFileTypes: true });
		} catch {
			continue;
		}

		for (const entry of entries) {
			const abs = join(dir, entry.name);
			if (entry.isDirectory()) {
				stack.push(abs);
			} else if (entry.isFile() && !entry.name.endsWith('.gz')) {
				const ext = extname(entry.name).toLowerCase();
				if (!COMPRESSIBLE.has(ext)) continue;
				try {
					await pipeline(
						createReadStream(abs),
						createGzip({ level: 9 }),
						createWriteStream(`${abs}.gz`),
					);
					count++;
				} catch {
					// non-fatal — skip this file
				}
			}
		}
	}

	return count;
}
