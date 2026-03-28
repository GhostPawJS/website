import { mkdir, writeFile as nodeWriteFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { SiteError } from '../errors.ts';

/**
 * Write `content` to `filePath`, creating parent directories as needed.
 * Throws `SiteError('io')` on failure.
 */
export async function writeFile(filePath: string, content: string | Buffer): Promise<void> {
	try {
		await mkdir(dirname(filePath), { recursive: true });
		await nodeWriteFile(filePath, content);
	} catch (err) {
		const e = err as NodeJS.ErrnoException;
		throw new SiteError('io', `Failed to write "${filePath}": ${e.message}`);
	}
}
