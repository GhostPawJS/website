/**
 * Stub for node:fs — forwards sync ops to memfs, no-ops watch().
 *
 * Aliased in build_demo.mjs:
 *   'node:fs' → this file
 */
import { vfs } from '../vfs.ts';

export const watch = () => ({
	close() {},
	on() {
		return this;
	},
});

export type FSWatcher = ReturnType<typeof watch>;

// Re-export everything else from memfs
export const { readFileSync, writeFileSync, existsSync, mkdirSync, statSync, constants } = vfs;

export default vfs;
