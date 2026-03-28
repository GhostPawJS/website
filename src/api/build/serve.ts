// ---------------------------------------------------------------------------
// Dev server — serves dist/ over HTTP with optional livereload via SSE.
//
// Design:
//   - Pure node:http, zero external dependencies
//   - File watcher on content/, templates/, data/, assets/, site.json
//   - Debounced rebuild (300 ms) on any source change
//   - SSE endpoint /__livereload broadcasts "reload" event after each build
//   - Livereload snippet injected before </body> in HTML responses
//   - Module-level Map keeps one server per dir (prevents double-start)
// ---------------------------------------------------------------------------

import { type FSWatcher, watch } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { extname, join } from 'node:path';
import { build } from '../../build/build.ts';
import { SiteError } from '../../errors.ts';
import { resolvePaths } from '../../project/paths.ts';
import type { ServeInstance, ServeOptions } from '../../types.ts';

// ---------------------------------------------------------------------------
// MIME types
// ---------------------------------------------------------------------------

const MIME: Record<string, string> = {
	'.html': 'text/html; charset=utf-8',
	'.css': 'text/css',
	'.js': 'application/javascript',
	'.mjs': 'application/javascript',
	'.json': 'application/json',
	'.svg': 'image/svg+xml',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.gif': 'image/gif',
	'.webp': 'image/webp',
	'.avif': 'image/avif',
	'.ico': 'image/x-icon',
	'.txt': 'text/plain',
	'.xml': 'application/xml',
	'.woff': 'font/woff',
	'.woff2': 'font/woff2',
	'.ttf': 'font/ttf',
	'.otf': 'font/otf',
};

// ---------------------------------------------------------------------------
// Livereload snippet (injected before </body> in all HTML responses)
// ---------------------------------------------------------------------------

const LIVERELOAD_SNIPPET = `<script>
(function(){
  var src = new EventSource('/__livereload');
  src.addEventListener('reload', function(){ location.reload(); });
  src.onerror = function(){ src.close(); };
})();
</script>`;

// ---------------------------------------------------------------------------
// Active server registry
// ---------------------------------------------------------------------------

interface ServerEntry {
	server: ReturnType<typeof createServer>;
	watcher: FSWatcher | null;
	instance: ServeInstance;
	sseClients: Set<ServerResponse>;
}

const activeServers = new Map<string, ServerEntry>();

// ---------------------------------------------------------------------------
// serve()
// ---------------------------------------------------------------------------

/**
 * Start a local HTTP dev server for the project at `dir`.
 *
 * If a server is already running for this directory, returns the existing
 * instance rather than starting a duplicate.
 */
export async function serve(dir: string, opts: ServeOptions = {}): Promise<ServeInstance> {
	const existing = activeServers.get(dir);
	if (existing) return existing.instance;

	const port = opts.port ?? 3000;
	const host = opts.host ?? 'localhost';
	const livereload = opts.livereload !== false;

	const paths = resolvePaths(dir);

	// Initial build
	await build(dir);

	const sseClients = new Set<ServerResponse>();

	// ---------------------------------------------------------------------------
	// HTTP server
	// ---------------------------------------------------------------------------

	const server = createServer((req: IncomingMessage, res: ServerResponse) => {
		const url = req.url ?? '/';

		// SSE livereload endpoint
		if (livereload && url === '/__livereload') {
			res.writeHead(200, {
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache',
				Connection: 'keep-alive',
				'X-Accel-Buffering': 'no',
			});
			res.write(':\n\n'); // comment to open connection
			sseClients.add(res);
			req.on('close', () => sseClients.delete(res));
			return;
		}

		serveStatic(url, paths.dist, livereload, res).catch((err) => {
			if (!res.headersSent) {
				res.writeHead(500, { 'Content-Type': 'text/plain' });
			}
			res.end(`Server error: ${err instanceof Error ? err.message : String(err)}`);
		});
	});

	await new Promise<void>((resolve, reject) => {
		server.once('error', reject);
		server.listen(port, host, resolve);
	});

	// Capture the actual port (important when port=0 lets OS pick one)
	const assignedPort = (server.address() as { port: number } | null)?.port ?? port;

	// ---------------------------------------------------------------------------
	// File watcher
	// ---------------------------------------------------------------------------

	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	let watcher: FSWatcher | null = null;

	if (livereload) {
		const watchTargets = [paths.content, paths.templates, paths.data, paths.assets, paths.siteJson];

		try {
			watcher = watch(paths.root, { recursive: true }, (_event, filename) => {
				// Only react to changes in watched source directories
				const rel = filename ?? '';
				const relevant = watchTargets.some((t) => {
					const relTarget = t.slice(paths.root.length + 1);
					return rel.startsWith(relTarget) || rel === 'site.json';
				});
				if (!relevant) return;

				if (debounceTimer) clearTimeout(debounceTimer);
				debounceTimer = setTimeout(() => {
					build(dir, { skipClean: false })
						.then(() => broadcastReload(sseClients))
						.catch(() => {
							/* rebuild errors are non-fatal for the server */
						});
				}, 300);
			});
		} catch {
			// fs.watch may fail on some systems — server continues without livereload
			watcher = null;
		}
	}

	const instance: ServeInstance = {
		dir,
		port: assignedPort,
		host,
		url: `http://${host}:${assignedPort}`,
	};

	activeServers.set(dir, { server, watcher, instance, sseClients });
	return instance;
}

// ---------------------------------------------------------------------------
// stop()
// ---------------------------------------------------------------------------

/**
 * Stop the dev server for `dir`.
 * Throws `SiteError('not_found')` if no server is running for this directory.
 */
export async function stop(dir: string): Promise<void> {
	const entry = activeServers.get(dir);
	if (!entry) throw new SiteError('not_found', `No server running for: "${dir}"`);

	activeServers.delete(dir);

	// Close all SSE connections
	for (const client of entry.sseClients) {
		try {
			client.end();
		} catch {
			/* ignore */
		}
	}
	entry.sseClients.clear();

	// Stop watcher
	if (entry.watcher) {
		try {
			entry.watcher.close();
		} catch {
			/* ignore */
		}
	}

	// Close HTTP server
	await new Promise<void>((resolve) => {
		entry.server.close(() => resolve());
	});
}

// ---------------------------------------------------------------------------
// Static file serving
// ---------------------------------------------------------------------------

async function serveStatic(
	url: string,
	distDir: string,
	livereload: boolean,
	res: ServerResponse,
): Promise<void> {
	// Strip query string
	const pathname = url.split('?')[0] ?? '/';

	// Try exact file, then index.html for directory-style URLs
	const candidates = [
		join(distDir, pathname),
		join(distDir, pathname, 'index.html'),
		join(distDir, pathname.replace(/\/$/, ''), 'index.html'),
	];

	for (const candidate of candidates) {
		try {
			const s = await stat(candidate);
			if (!s.isFile()) continue;

			const ext = extname(candidate).toLowerCase();
			const mime = MIME[ext] ?? 'application/octet-stream';
			const isHtml = mime.startsWith('text/html');

			let content: Buffer = await readFile(candidate);
			if (isHtml && livereload) {
				const text = content.toString('utf8').replace('</body>', `${LIVERELOAD_SNIPPET}</body>`);
				content = Buffer.from(text, 'utf8');
			}

			res.writeHead(200, { 'Content-Type': mime, 'Content-Length': content.length });
			res.end(content);
			return;
		} catch {}
	}

	// 404 — try dist/404.html, then plain text
	const notFoundPath = join(distDir, '404.html');
	try {
		const content = await readFile(notFoundPath);
		res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
		res.end(content);
	} catch {
		res.writeHead(404, { 'Content-Type': 'text/plain' });
		res.end(`404 Not Found: ${pathname}`);
	}
}

// ---------------------------------------------------------------------------
// SSE broadcast
// ---------------------------------------------------------------------------

function broadcastReload(clients: Set<ServerResponse>): void {
	const msg = 'event: reload\ndata: {}\n\n';
	for (const client of clients) {
		try {
			client.write(msg);
		} catch {
			clients.delete(client);
		}
	}
}
