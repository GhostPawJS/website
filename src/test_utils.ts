import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Run `fn` with a freshly-created temp directory, then clean it up regardless
 * of whether `fn` throws. Returns whatever `fn` returns.
 */
export async function withTmpDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
	const dir = await mkdtemp(join(tmpdir(), 'ghostpaw-'));
	try {
		return await fn(dir);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
}
