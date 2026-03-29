/**
 * Production HTTP server for `website start`.
 *
 * Design goals:
 *   - Safe: path traversal guard, dotfile protection, no directory listing
 *   - Correct: clean URL redirects, proper MIME types, ETag for HTML
 *   - Fast: serve pre-compressed .gz files if client accepts gzip
 *   - Hardened: security headers, request timeout, graceful shutdown
 *   - Zero deps beyond node: built-ins only
 */

import { createReadStream } from 'node:fs';
import { access, readFile, stat } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { basename, extname, join, normalize, sep } from 'node:path';

// ---------------------------------------------------------------------------
// MIME types
// ---------------------------------------------------------------------------

const MIME: Record<string, string> = {
	'.html': 'text/html; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.js': 'application/javascript; charset=utf-8',
	'.mjs': 'application/javascript; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.xml': 'application/xml; charset=utf-8',
	'.svg': 'image/svg+xml',
	'.txt': 'text/plain; charset=utf-8',
	'.webmanifest': 'application/manifest+json',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.gif': 'image/gif',
	'.webp': 'image/webp',
	'.avif': 'image/avif',
	'.ico': 'image/x-icon',
	'.woff': 'font/woff',
	'.woff2': 'font/woff2',
	'.ttf': 'font/ttf',
	'.otf': 'font/otf',
	'.pdf': 'application/pdf',
	'.mp4': 'video/mp4',
	'.mp3': 'audio/mpeg',
};

// ---------------------------------------------------------------------------
// Security headers sent on every response
// ---------------------------------------------------------------------------

const SECURITY_HEADERS: Record<string, string> = {
	'X-Content-Type-Options': 'nosniff',
	'X-Frame-Options': 'SAMEORIGIN',
	'Referrer-Policy': 'strict-origin-when-cross-origin',
	'X-XSS-Protection': '0',
	'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface StartServerOptions {
	port?: number;
	/** Disable security header injection (e.g. when behind a proxy that sets them). */
	noSecurityHeaders?: boolean;
	/** Print one-line access log per request. */
	log?: boolean;
	/** Request timeout in ms. Default: 30_000. */
	timeout?: number;
	/** Honour X-Forwarded-For / X-Forwarded-Proto (enable behind trusted proxy). */
	trustProxy?: boolean;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Start a production-grade HTTP server serving `distDir`.
 * Resolves once the server is listening. Never resolves after that —
 * caller awaits it to keep the process alive.
 *
 * Registers SIGTERM + SIGINT handlers for graceful shutdown.
 */
export async function startServer(distDir: string, options: StartServerOptions = {}): Promise<never> {
	const port = options.port ?? (Number(process.env.PORT) || 3000);
	const timeout = options.timeout ?? 30_000;

	// Normalise distDir so path comparisons are reliable
	const root = normalize(distDir) + sep;

	const server = createServer((req, res) => {
		const start = Date.now();
		handleRequest(req, res, distDir, root, options)
			.then((status) => {
				if (options.log) {
					const ms = Date.now() - start;
					const ip = options.trustProxy
						? (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
						: req.socket.remoteAddress;
					process.stdout.write(`${new Date().toISOString()} ${ip ?? '-'} ${req.method} ${req.url} ${status} ${ms}ms\n`);
				}
			})
			.catch((err) => {
				if (!res.headersSent) {
					res.writeHead(500, { 'Content-Type': 'text/plain' });
					res.end('Internal Server Error');
				}
				process.stderr.write(`Server error: ${err instanceof Error ? err.message : String(err)}\n`);
			});
	});

	server.maxHeadersCount = 50;
	server.requestTimeout = timeout;

	await new Promise<void>((resolve, reject) => {
		server.once('error', reject);
		server.listen(port, '0.0.0.0', resolve);
	});

	// Graceful shutdown: finish in-flight requests before exiting
	const shutdown = () => {
		server.close(() => process.exit(0));
		// Force-exit after 5s if connections remain open
		setTimeout(() => process.exit(0), 5_000).unref();
	};
	process.once('SIGTERM', shutdown);
	process.once('SIGINT', shutdown);

	// Keep alive forever (caller awaits this)
	return new Promise<never>(() => {});
}

// ---------------------------------------------------------------------------
// Request handler
// ---------------------------------------------------------------------------

async function handleRequest(
	req: IncomingMessage,
	res: ServerResponse,
	distDir: string,
	root: string,
	options: StartServerOptions,
): Promise<number> {
	const rawPath = req.url?.split('?')[0] ?? '/';

	// --- Path traversal guard ---
	const normalised = normalize(rawPath).replace(/\\/g, '/');
	const candidate = join(distDir, normalised);
	if (!candidate.startsWith(root) && candidate !== distDir) {
		return respond404(res, distDir, options);
	}

	// --- Dotfile protection ---
	if (basename(normalised).startsWith('.')) {
		return respond404(res, distDir, options);
	}

	// --- Clean URL: /about/index.html → /about/ ---
	if (rawPath.endsWith('/index.html')) {
		const canonical = rawPath.slice(0, -'index.html'.length);
		res.writeHead(301, { Location: canonical });
		res.end();
		return 301;
	}

	// --- Clean URL: /about → /about/ (when a directory index exists) ---
	if (!rawPath.endsWith('/') && !extname(rawPath)) {
		try {
			await stat(join(distDir, rawPath, 'index.html'));
			res.writeHead(301, { Location: `${rawPath}/` });
			res.end();
			return 301;
		} catch {
			// not a directory — fall through to file lookup
		}
	}

	// --- Resolve file candidates ---
	const candidates = rawPath.endsWith('/')
		? [join(distDir, rawPath, 'index.html')]
		: [join(distDir, rawPath), join(distDir, rawPath, 'index.html')];

	for (const filePath of candidates) {
		let s: Awaited<ReturnType<typeof stat>>;
		try {
			s = await stat(filePath);
		} catch {
			continue;
		}
		if (!s.isFile()) continue;

		await serveFile(req, res, filePath, s.size, s.mtimeMs, options);
		return 200;
	}

	return respond404(res, distDir, options);
}

// ---------------------------------------------------------------------------
// File serving
// ---------------------------------------------------------------------------

async function serveFile(
	req: IncomingMessage,
	res: ServerResponse,
	filePath: string,
	size: number,
	mtimeMs: number,
	options: StartServerOptions,
): Promise<void> {
	const ext = extname(filePath).toLowerCase();
	const mime = MIME[ext] ?? 'application/octet-stream';
	const isHtml = mime.startsWith('text/html');
	const fileName = basename(filePath);

	// ETag from mtime + size (fast, no hashing at serve time)
	const etag = `"${mtimeMs.toString(36)}-${size.toString(36)}"`;

	// Conditional request — skip body if content unchanged
	if (req.headers['if-none-match'] === etag) {
		res.writeHead(304, { ETag: etag });
		res.end();
		return;
	}

	// Cache-Control strategy
	const cacheControl = isHtml
		? 'no-cache' // always revalidate HTML; ETag handles bandwidth
		: isHashedAsset(fileName)
			? 'max-age=31536000, immutable' // content-hashed → cache forever
			: 'max-age=3600'; // everything else: 1 hour

	const headers: Record<string, string> = {
		'Content-Type': mime,
		'Cache-Control': cacheControl,
		ETag: etag,
		...(options.noSecurityHeaders ? {} : SECURITY_HEADERS),
	};

	// Prefer pre-compressed .gz if client accepts gzip (written by `website build`)
	const acceptEncoding = (req.headers['accept-encoding'] as string) ?? '';
	if (acceptEncoding.includes('gzip')) {
		const gzPath = `${filePath}.gz`;
		try {
			await access(gzPath);
			const gzStat = await stat(gzPath);
			headers['Content-Encoding'] = 'gzip';
			headers['Content-Length'] = String(gzStat.size);
			headers['Vary'] = 'Accept-Encoding';
			res.writeHead(200, headers);
			createReadStream(gzPath).pipe(res);
			return;
		} catch {
			// No pre-compressed version — serve raw
		}
	}

	headers['Content-Length'] = String(size);
	res.writeHead(200, headers);
	createReadStream(filePath).pipe(res);
}

// ---------------------------------------------------------------------------
// 404
// ---------------------------------------------------------------------------

async function respond404(
	res: ServerResponse,
	distDir: string,
	options: StartServerOptions,
): Promise<number> {
	const notFoundPath = join(distDir, '404.html');
	try {
		const content = await readFile(notFoundPath);
		res.writeHead(404, {
			'Content-Type': 'text/html; charset=utf-8',
			'Content-Length': String(content.length),
			...(options.noSecurityHeaders ? {} : SECURITY_HEADERS),
		});
		res.end(content);
	} catch {
		res.writeHead(404, { 'Content-Type': 'text/plain' });
		res.end('404 Not Found');
	}
	return 404;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Detect content-hashed filenames so they can get `immutable` cache headers.
 * Matches common patterns: `style.a1b2c3.css`, `app-abc12345.js`, etc.
 */
function isHashedAsset(filename: string): boolean {
	// Six+ hex chars before the extension (dot-separated or dash-separated)
	return /[.\-][a-f0-9]{6,}\.[a-z0-9]+$/i.test(filename);
}
