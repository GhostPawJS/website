/**
 * Stub for node:fs/promises — forwards to the shared memfs volume.
 *
 * Aliased in build_demo.mjs:
 *   'node:fs/promises' → this file
 */
import { vfs } from '../vfs.ts';

const p = vfs.promises;

export const readFile = p.readFile.bind(p);
export const writeFile = p.writeFile.bind(p);
export const mkdir = p.mkdir.bind(p);
export const rm = p.rm.bind(p);
export const stat = p.stat.bind(p);
export const copyFile = p.copyFile.bind(p);
export const readdir = p.readdir.bind(p);
export const opendir = p.opendir.bind(p);

export default p;
