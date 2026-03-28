import { readFile as nodeReadFile } from 'node:fs/promises';
import { SiteError } from '../errors.ts';

/**
 * Read a file as a UTF-8 string. Throws `SiteError('not_found')` when
 * the file does not exist and `SiteError('io')` on other OS errors.
 */
export async function readFile(filePath: string): Promise<string> {
	try {
		return await nodeReadFile(filePath, 'utf8');
	} catch (err) {
		const e = err as NodeJS.ErrnoException;
		if (e.code === 'ENOENT') {
			throw new SiteError('not_found', `File not found: "${filePath}"`);
		}
		throw new SiteError('io', `Failed to read "${filePath}": ${e.message}`);
	}
}

/**
 * Read a file as a Buffer. Throws the same errors as `readFile`.
 */
export async function readFileBytes(filePath: string): Promise<Buffer> {
	try {
		return await nodeReadFile(filePath);
	} catch (err) {
		const e = err as NodeJS.ErrnoException;
		if (e.code === 'ENOENT') {
			throw new SiteError('not_found', `File not found: "${filePath}"`);
		}
		throw new SiteError('io', `Failed to read "${filePath}": ${e.message}`);
	}
}
