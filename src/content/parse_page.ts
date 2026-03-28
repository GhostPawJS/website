import { SiteError } from '../errors.ts';
import { readFile } from '../fs/read_file.ts';
import type { ContentPage, PageFrontmatter } from '../types.ts';
import { extractFrontmatter } from '../yaml/index.ts';
import { fileToSlug, slugToUrl } from './url_routing.ts';

/**
 * Parse a markdown content file into a `ContentPage`.
 *
 * @param absolutePath  Absolute path to the `.md` file.
 * @param relativePath  Path relative to the content root (POSIX), used for URL derivation.
 */
export async function parsePage(absolutePath: string, relativePath: string): Promise<ContentPage> {
	const raw = await readFile(absolutePath);
	return parsePageSource(raw, absolutePath, relativePath);
}

/**
 * Parse a markdown source string into a `ContentPage` (no I/O).
 * Useful for testing.
 */
export function parsePageSource(
	source: string,
	absolutePath: string,
	relativePath: string,
): ContentPage {
	let frontmatter: PageFrontmatter = {};
	let body = source;

	try {
		const { data, body: parsedBody } = extractFrontmatter(source);
		frontmatter = data as PageFrontmatter;
		body = parsedBody;
	} catch (err) {
		throw new SiteError(
			'validation',
			`Failed to parse frontmatter in "${absolutePath}": ${err instanceof Error ? err.message : String(err)}`,
		);
	}

	const slug = fileToSlug(relativePath);
	const url = slugToUrl(slug);
	// Derive collection from the POSIX directory portion of relativePath.
	// blog/_index.md → dir 'blog' → collection 'blog'
	// blog/post.md   → dir 'blog' → collection 'blog'
	// index.md       → dir ''     → collection null
	// about.md       → dir ''     → collection null
	const posixRel = relativePath.replace(/\\/g, '/');
	const dirPart = posixRel.includes('/') ? posixRel.slice(0, posixRel.indexOf('/')) : '';
	const collection = dirPart || null;

	return { file: absolutePath, slug, url, frontmatter, body, collection };
}
