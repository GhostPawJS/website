/**
 * Shared in-memory filesystem volume for the browser demo.
 *
 * All demo code imports `vol` and `vfs` from here. The alias overrides in
 * build_demo.mjs redirect `node:fs/promises` and `node:fs` to the stubs that
 * wrap this singleton.
 */
import { createFsFromVolume, Volume } from 'memfs';

export const vol = new Volume();
export const vfs = createFsFromVolume(vol);
