import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { SiteError } from '../../errors.ts';
import { readFile } from '../../fs/read_file.ts';
import { writeFile } from '../../fs/write_file.ts';
import { resolvePaths } from '../../project/paths.ts';
import type { PageFrontmatter } from '../../types.ts';
import { serializeFrontmatter } from '../../yaml/serialize.ts';

/**
 * Create or update a content page.
 *
 * `path` is relative to the `content/` directory (e.g. `"blog/my-post.md"`).
 * The file is written with YAML frontmatter followed by the markdown body.
 */
export async function writePage(
	dir: string,
	path: string,
	frontmatter: PageFrontmatter,
	markdown: string,
): Promise<void> {
	const paths = resolvePaths(dir);
	validatePagePath(path);
	const absPath = join(paths.content, path.endsWith('.md') ? path : `${path}.md`);
	const fm = serializeFrontmatter(frontmatter as Record<string, unknown>);
	const source = fm ? `---\n${fm}\n---\n\n${markdown}` : markdown;
	await writeFile(absPath, source);
}

/**
 * Patch the frontmatter of an existing page without touching the body.
 *
 * Reads the current file, merges `patch` into the existing frontmatter
 * (new keys added, existing keys overwritten, unmentioned keys preserved),
 * then rewrites the file. The markdown body is never modified.
 *
 * Throws `SiteError('not_found')` if the page does not exist.
 */
export async function patchPage(
	dir: string,
	path: string,
	patch: Record<string, unknown>,
): Promise<void> {
	const paths = resolvePaths(dir);
	validatePagePath(path);
	const absPath = join(paths.content, path.endsWith('.md') ? path : `${path}.md`);
	const source = await readFile(absPath);

	// Split existing frontmatter from body
	const fmMatch = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
	let existingFm: Record<string, unknown> = {};
	let body = source;
	if (fmMatch) {
		const { extractFrontmatter } = await import('../../yaml/parse.ts');
		existingFm = extractFrontmatter(`---\n${fmMatch[1]}\n---\n`).data;
		body = fmMatch[2] ?? '';
	}

	const merged = { ...existingFm, ...patch };
	const fm = serializeFrontmatter(merged);
	const output = fm ? `---\n${fm}\n---\n\n${body.replace(/^\n/, '')}` : body;
	await writeFile(absPath, output);
}

/**
 * Delete a content page.
 * Throws `SiteError('not_found')` if the file does not exist.
 */
export async function deletePage(dir: string, path: string): Promise<void> {
	const paths = resolvePaths(dir);
	validatePagePath(path);
	const absPath = join(paths.content, path.endsWith('.md') ? path : `${path}.md`);
	// Verify it exists first
	await readFile(absPath);
	try {
		await rm(absPath);
	} catch (err) {
		const e = err as NodeJS.ErrnoException;
		throw new SiteError('io', `Failed to delete page "${path}": ${e.message}`);
	}
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validatePagePath(path: string): void {
	if (!path || /[<>:"|?*]/.test(path) || path.includes('..')) {
		throw new SiteError('validation', `Invalid page path: "${path}"`);
	}
}
