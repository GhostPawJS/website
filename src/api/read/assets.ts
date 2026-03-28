import { stat } from 'node:fs/promises';
import { join, posix } from 'node:path';
import { SiteError } from '../../errors.ts';
import { hashFile } from '../../fs/hash_file.ts';
import { readFile } from '../../fs/read_file.ts';
import { walk } from '../../fs/walk.ts';
import { resolvePaths } from '../../project/paths.ts';
import type { AssetDetail, AssetFilter, AssetSummary } from '../../types.ts';

// ---------------------------------------------------------------------------
// MIME type lookup (covers all types the build pipeline produces)
// ---------------------------------------------------------------------------

const MIME_MAP: Record<string, string> = {
	html: 'text/html',
	css: 'text/css',
	js: 'application/javascript',
	mjs: 'application/javascript',
	json: 'application/json',
	svg: 'image/svg+xml',
	png: 'image/png',
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	gif: 'image/gif',
	webp: 'image/webp',
	avif: 'image/avif',
	ico: 'image/x-icon',
	txt: 'text/plain',
	md: 'text/markdown',
	xml: 'application/xml',
	pdf: 'application/pdf',
	woff: 'font/woff',
	woff2: 'font/woff2',
	ttf: 'font/ttf',
	otf: 'font/otf',
	mp4: 'video/mp4',
	webm: 'video/webm',
	mp3: 'audio/mpeg',
	wav: 'audio/wav',
};

function mimeType(filePath: string): string {
	const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
	return MIME_MAP[ext] ?? 'application/octet-stream';
}

function isTextMime(mime: string): boolean {
	return (
		mime.startsWith('text/') ||
		mime === 'application/json' ||
		mime === 'application/javascript' ||
		mime === 'application/xml' ||
		mime === 'image/svg+xml'
	);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Return a summary of every asset file in the project's `assets/` directory. */
export async function listAssets(dir: string, filter?: AssetFilter): Promise<AssetSummary[]> {
	const paths = resolvePaths(dir);
	const summaries: AssetSummary[] = [];

	try {
		for await (const entry of walk(paths.assets)) {
			const s = await stat(entry.path);
			const mime = mimeType(entry.path);
			const summary: AssetSummary = {
				path: entry.relative,
				absolutePath: entry.path,
				mountPath: posix.join('/', entry.relative),
				mimeType: mime,
				size: s.size,
			};
			summaries.push(summary);
		}
	} catch {
		// assets/ directory missing — return empty list
		return [];
	}

	let result = summaries;
	if (filter?.mimeType !== undefined) {
		const prefix = filter.mimeType;
		result = result.filter((a) => a.mimeType.startsWith(prefix));
	}
	if (filter?.path !== undefined) {
		const prefix = filter.path;
		result = result.filter((a) => a.path.startsWith(prefix));
	}
	return result;
}

/**
 * Return full detail for a single asset file.
 * Text assets include their content; binary assets include their SHA-256 hash.
 *
 * `assetPath` is relative to the `assets/` root (e.g. `"css/style.css"`).
 * Throws `SiteError('not_found')` if the file does not exist.
 */
export async function getAsset(dir: string, assetPath: string): Promise<AssetDetail> {
	const paths = resolvePaths(dir);
	const absolutePath = join(paths.assets, assetPath);

	let fileSize: number;
	try {
		const s = await stat(absolutePath);
		fileSize = s.size;
	} catch {
		throw new SiteError('not_found', `Asset not found: "${assetPath}"`);
	}

	const mime = mimeType(absolutePath);
	const summary: AssetSummary = {
		path: assetPath,
		absolutePath,
		mountPath: posix.join('/', assetPath),
		mimeType: mime,
		size: fileSize,
	};

	if (isTextMime(mime)) {
		const content = await readFile(absolutePath);
		return { ...summary, content };
	}

	const hash = await hashFile(absolutePath);
	return { ...summary, hash };
}
