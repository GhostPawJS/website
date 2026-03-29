import { readdir } from 'node:fs/promises';
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
 * Uses an iterative stack with `readdir({withFileTypes:true})` to avoid
 * browser-incompatible async generator delegation (`yield*`) over Dir objects.
 *
 * @param root   Absolute path to start from.
 * @param filter Optional glob-style filter: if provided, only paths whose
 *               `relative` value matches are yielded.
 */
export async function* walk(
	root: string,
	filter?: (entry: WalkEntry) => boolean,
): AsyncGenerator<WalkEntry> {
	const stack: string[] = [root];
	while (stack.length > 0) {
		// biome-ignore lint/style/noNonNullAssertion: guarded by length check above
		const dir = stack.pop()!;
		const entries = await readdir(dir, { withFileTypes: true });
		for (const dirent of entries) {
			const abs = join(dir, dirent.name);
			// relative uses POSIX separators for consistent URL/path building
			const rel = abs.slice(root.length + 1).replace(/\\/g, '/');
			if (dirent.isDirectory()) {
				stack.push(abs);
			} else if (dirent.isFile()) {
				const entry: WalkEntry = { path: abs, relative: rel };
				if (!filter || filter(entry)) {
					yield entry;
				}
			}
		}
	}
}
