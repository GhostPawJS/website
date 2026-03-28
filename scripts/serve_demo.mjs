#!/usr/bin/env node

/**
 * Serves the demo/ directory over HTTP with SPA fallback.
 * Run after `npm run demo:build`.
 */

import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(import.meta.url), '..', '..');
const DEMO_DIR = join(ROOT, 'demo');
const PORT = Number(process.env.PORT ?? 4173);

const MIME = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'application/javascript',
	'.mjs': 'application/javascript',
	'.css': 'text/css',
	'.json': 'application/json',
	'.map': 'application/json',
	'.svg': 'image/svg+xml',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.ico': 'image/x-icon',
	'.txt': 'text/plain',
};

const server = createServer(async (req, res) => {
	const pathname = (req.url ?? '/').split('?')[0];
	const candidates = [
		join(DEMO_DIR, pathname),
		join(DEMO_DIR, pathname, 'index.html'),
		join(DEMO_DIR, 'index.html'), // SPA fallback
	];

	for (const candidate of candidates) {
		try {
			const s = await stat(candidate);
			if (!s.isFile()) continue;
			const ext = extname(candidate).toLowerCase();
			const mime = MIME[ext] ?? 'application/octet-stream';
			const content = await readFile(candidate);
			res.writeHead(200, { 'Content-Type': mime });
			res.end(content);
			return;
		} catch {}
	}

	res.writeHead(404, { 'Content-Type': 'text/plain' });
	res.end('404 Not Found');
});

server.listen(PORT, 'localhost', () => {
	console.log(`Demo running at http://localhost:${PORT}`);
});
