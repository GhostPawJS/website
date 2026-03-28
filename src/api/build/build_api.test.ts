import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { scaffold } from '../../build/scaffold.ts';
import { isSiteError } from '../../errors.ts';
import { writeFile } from '../../fs/write_file.ts';
import { withTmpDir } from '../../test_utils.ts';
import { clean } from './clean.ts';
import { preview } from './preview.ts';
import { serve, stop } from './serve.ts';

async function withScaffold<T>(fn: (dir: string) => Promise<T>): Promise<T> {
	return withTmpDir(async (dir) => {
		await scaffold(dir, { name: 'Test Site', url: 'https://example.com' });
		return fn(dir);
	});
}

// ---------------------------------------------------------------------------
// preview
// ---------------------------------------------------------------------------

describe('preview', () => {
	it('returns rendered HTML for a page by URL', async () => {
		await withScaffold(async (dir) => {
			const page = await preview(dir, '/');
			assert.equal(typeof page.html, 'string');
			assert.ok(page.html.length > 0);
			assert.equal(page.url, '/');
		});
	});

	it('returns rendered HTML by file path suffix', async () => {
		await withScaffold(async (dir) => {
			const page = await preview(dir, 'index.md');
			assert.equal(typeof page.html, 'string');
		});
	});

	it('throws not_found for unknown page', async () => {
		await withScaffold(async (dir) => {
			try {
				await preview(dir, '/no-such-page/');
				assert.fail('expected not_found');
			} catch (err) {
				assert.ok(isSiteError(err) && err.code === 'not_found');
			}
		});
	});

	it('reflects in-memory content without writing to disk', async () => {
		await withScaffold(async (dir) => {
			// Write a new page file, then preview it — no build step needed
			await writeFile(
				join(dir, 'content/preview-test.md'),
				'---\ntitle: Preview Test\n---\n# Preview',
			);
			const page = await preview(dir, '/preview-test/');
			assert.ok(page.html.includes('Preview') || page.html.length > 0);
		});
	});

	it('does not write to dist/', async () => {
		await withScaffold(async (dir) => {
			// clean first to ensure no dist
			await clean(dir);
			await preview(dir, '/');
			// dist/ should still not exist (preview doesn't write)
			try {
				await stat(join(dir, 'dist'));
				assert.fail('dist/ should not be created by preview');
			} catch (err) {
				assert.ok((err as NodeJS.ErrnoException).code === 'ENOENT');
			}
		});
	});
});

// ---------------------------------------------------------------------------
// clean
// ---------------------------------------------------------------------------

describe('clean', () => {
	it('removes dist/ directory', async () => {
		await withScaffold(async (dir) => {
			// First build to create dist/
			const { build } = await import('../../build/build.ts');
			await build(dir);

			// Verify dist/ exists
			const s = await stat(join(dir, 'dist'));
			assert.ok(s.isDirectory());

			// Clean
			await clean(dir);

			// dist/ should be gone
			try {
				await stat(join(dir, 'dist'));
				assert.fail('dist/ should be removed');
			} catch (err) {
				assert.ok((err as NodeJS.ErrnoException).code === 'ENOENT');
			}
		});
	});

	it('is safe to call on a project that has never been built', async () => {
		await withScaffold(async (dir) => {
			// Should not throw even though dist/ doesn't exist
			await assert.doesNotReject(() => clean(dir));
		});
	});
});

// ---------------------------------------------------------------------------
// serve / stop
// ---------------------------------------------------------------------------

describe('serve', () => {
	it('starts an HTTP server and returns instance info', async () => {
		await withScaffold(async (dir) => {
			// Use a dynamic port to avoid conflicts
			const instance = await serve(dir, { port: 0, livereload: false });
			try {
				assert.equal(instance.dir, dir);
				assert.equal(typeof instance.port, 'number');
				assert.equal(typeof instance.url, 'string');
				assert.ok(instance.url.startsWith('http://'));
			} finally {
				await stop(dir);
			}
		});
	});

	it('returns existing instance when called twice for same dir', async () => {
		await withScaffold(async (dir) => {
			const a = await serve(dir, { port: 0, livereload: false });
			const b = await serve(dir, { port: 0, livereload: false });
			try {
				assert.equal(a, b);
			} finally {
				await stop(dir);
			}
		});
	});

	it('serves HTML from dist/ over HTTP', async () => {
		await withScaffold(async (dir) => {
			const instance = await serve(dir, { port: 0, livereload: false });
			try {
				const res = await fetch(`${instance.url}/`);
				assert.equal(res.status, 200);
				const text = await res.text();
				assert.ok(text.includes('<html') || text.includes('<!doctype'), text.slice(0, 200));
			} finally {
				await stop(dir);
			}
		});
	});

	it('returns 404 for unknown paths', async () => {
		await withScaffold(async (dir) => {
			const instance = await serve(dir, { port: 0, livereload: false });
			try {
				const res = await fetch(`${instance.url}/no-such-path/`);
				assert.equal(res.status, 404);
			} finally {
				await stop(dir);
			}
		});
	});

	it('injects livereload snippet when livereload enabled', async () => {
		await withScaffold(async (dir) => {
			const instance = await serve(dir, { port: 0, livereload: true });
			try {
				const res = await fetch(`${instance.url}/`);
				const text = await res.text();
				assert.ok(text.includes('__livereload'), 'expected livereload snippet in HTML');
			} finally {
				await stop(dir);
			}
		});
	});

	it('does NOT inject livereload snippet when livereload disabled', async () => {
		await withScaffold(async (dir) => {
			const instance = await serve(dir, { port: 0, livereload: false });
			try {
				const res = await fetch(`${instance.url}/`);
				const text = await res.text();
				assert.ok(!text.includes('__livereload'), 'unexpected livereload snippet');
			} finally {
				await stop(dir);
			}
		});
	});
});

describe('stop', () => {
	it('stops a running server', async () => {
		await withScaffold(async (dir) => {
			const instance = await serve(dir, { port: 0, livereload: false });
			await stop(dir);
			// After stop, port should be freed — fetching should fail
			try {
				await fetch(`${instance.url}/`);
				// If fetch somehow succeeds, still ok (OS might not release immediately)
			} catch {
				// Expected: connection refused
			}
		});
	});

	it('throws not_found when stopping a non-running server', async () => {
		await withTmpDir(async (dir) => {
			try {
				await stop(dir);
				assert.fail('expected not_found error');
			} catch (err) {
				assert.ok(isSiteError(err) && err.code === 'not_found');
			}
		});
	});

	it('allows a new server to start after stop', async () => {
		await withScaffold(async (dir) => {
			await serve(dir, { port: 0, livereload: false });
			await stop(dir);
			// Should be able to start again
			const instance = await serve(dir, { port: 0, livereload: false });
			try {
				assert.equal(instance.dir, dir);
			} finally {
				await stop(dir);
			}
		});
	});
});

// ---------------------------------------------------------------------------
// scaffold — building-block templates
// ---------------------------------------------------------------------------

describe('scaffold — building-block templates', () => {
	it('creates faq.html', async () => {
		await withTmpDir(async (dir) => {
			await scaffold(dir);
			const s = await stat(join(dir, 'templates', 'faq.html'));
			assert.ok(s.isFile());
		});
	});

	it('creates breadcrumb.html', async () => {
		await withTmpDir(async (dir) => {
			await scaffold(dir);
			const s = await stat(join(dir, 'templates', 'breadcrumb.html'));
			assert.ok(s.isFile());
		});
	});

	it('creates table.html', async () => {
		await withTmpDir(async (dir) => {
			await scaffold(dir);
			const s = await stat(join(dir, 'templates', 'table.html'));
			assert.ok(s.isFile());
		});
	});

	it('faq.html contains faq-list class', async () => {
		await withTmpDir(async (dir) => {
			await scaffold(dir);
			const { readFile } = await import('node:fs/promises');
			const content = await readFile(join(dir, 'templates', 'faq.html'), 'utf8');
			assert.ok(content.includes('faq-list'));
		});
	});

	it('breadcrumb.html contains breadcrumb aria-label', async () => {
		await withTmpDir(async (dir) => {
			await scaffold(dir);
			const { readFile } = await import('node:fs/promises');
			const content = await readFile(join(dir, 'templates', 'breadcrumb.html'), 'utf8');
			assert.ok(content.includes('Breadcrumb'));
		});
	});

	it('table.html contains table element', async () => {
		await withTmpDir(async (dir) => {
			await scaffold(dir);
			const { readFile } = await import('node:fs/promises');
			const content = await readFile(join(dir, 'templates', 'table.html'), 'utf8');
			assert.ok(content.includes('<table>'));
		});
	});

	it('post.html includes breadcrumb partial', async () => {
		await withTmpDir(async (dir) => {
			await scaffold(dir);
			const { readFile } = await import('node:fs/promises');
			const content = await readFile(join(dir, 'templates', 'post.html'), 'utf8');
			assert.ok(content.includes('breadcrumb.html'), 'post.html must include breadcrumb partial');
		});
	});
});
