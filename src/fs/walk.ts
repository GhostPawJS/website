import { opendir } from 'node:fs/promises';
import { join } from 'node:path';

export interface WalkEntry {
	/** Absolute path to the file. */
	path: string;
	/** Path relative to the walk root (uses POSIX separators). */
	relative: string;
}

/**
 * Recursively yield every regular file under `root`.
 * Entries are yielded depth-first; order within a directory is readdir order.
 *
 * @param root   Absolute path to start from.
 * @param filter Optional glob-style filter: if provided, only paths whose
 *               `relative` value matches are yielded.
 */
export async function* walk(
	root: string,
	filter?: (entry: WalkEntry) => boolean,
): AsyncGenerator<WalkEntry> {
	yield* walkDir(root, root, filter);
}

async function* walkDir(
	root: string,
	dir: string,
	filter: ((entry: WalkEntry) => boolean) | undefined,
): AsyncGenerator<WalkEntry> {
	const d = await opendir(dir);
	for await (const dirent of d) {
		const abs = join(dir, dirent.name);
		// relative uses POSIX separators for consistent URL/path building
		const rel = abs.slice(root.length + 1).replace(/\\/g, '/');
		if (dirent.isDirectory()) {
			yield* walkDir(root, abs, filter);
		} else if (dirent.isFile()) {
			const entry: WalkEntry = { path: abs, relative: rel };
			if (!filter || filter(entry)) {
				yield entry;
			}
		}
	}
}
