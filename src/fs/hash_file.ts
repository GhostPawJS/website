import { createHash } from 'node:crypto';
import { readFileBytes } from './read_file.ts';

/**
 * Compute the SHA-256 hex digest of a file's contents.
 * Throws `SiteError('not_found')` or `SiteError('io')` on failure.
 */
export async function hashFile(filePath: string): Promise<string> {
	const buf = await readFileBytes(filePath);
	return createHash('sha256').update(buf).digest('hex');
}

/**
 * Compute the SHA-256 hex digest of a string or Buffer directly (no I/O).
 */
export function hashContent(content: string | Buffer): string {
	return createHash('sha256').update(content).digest('hex');
}
