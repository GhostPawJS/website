import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { isSiteError } from '../errors.ts';
import { withTmpDir } from '../test_utils.ts';
import { copyDir } from './copy_dir.ts';
import { hashContent, hashFile } from './hash_file.ts';
import { readFile, readFileBytes } from './read_file.ts';
import { walk } from './walk.ts';
import { writeFile } from './write_file.ts';

// ---------------------------------------------------------------------------
// readFile
// ---------------------------------------------------------------------------

describe('readFile', () => {
	it('reads an existing file', async () => {
		await withTmpDir(async (dir) => {
			const p = join(dir, 'hello.txt');
			await writeFile(p, 'hello world');
			const content = await readFile(p);
			assert.equal(content, 'hello world');
		});
	});

	it('throws not_found for missing file', async () => {
		await withTmpDir(async (dir) => {
			await assert.rejects(
				() => readFile(join(dir, 'nope.txt')),
				(err: unknown) => isSiteError(err) && err.code === 'not_found',
			);
		});
	});
});

describe('readFileBytes', () => {
	it('reads bytes of an existing file', async () => {
		await withTmpDir(async (dir) => {
			const p = join(dir, 'bytes.bin');
			await writeFile(p, Buffer.from([0x01, 0x02, 0x03]));
			const buf = await readFileBytes(p);
			assert.deepEqual([...buf], [0x01, 0x02, 0x03]);
		});
	});

	it('throws not_found for missing file', async () => {
		await withTmpDir(async (dir) => {
			await assert.rejects(
				() => readFileBytes(join(dir, 'nope.bin')),
				(err: unknown) => isSiteError(err) && err.code === 'not_found',
			);
		});
	});
});

// ---------------------------------------------------------------------------
// writeFile
// ---------------------------------------------------------------------------

describe('writeFile', () => {
	it('creates file and parent directories', async () => {
		await withTmpDir(async (dir) => {
			const p = join(dir, 'a', 'b', 'c.txt');
			await writeFile(p, 'nested');
			const content = await readFile(p);
			assert.equal(content, 'nested');
		});
	});

	it('overwrites existing file', async () => {
		await withTmpDir(async (dir) => {
			const p = join(dir, 'over.txt');
			await writeFile(p, 'first');
			await writeFile(p, 'second');
			assert.equal(await readFile(p), 'second');
		});
	});

	it('writes Buffer content', async () => {
		await withTmpDir(async (dir) => {
			const p = join(dir, 'buf.bin');
			await writeFile(p, Buffer.from('binary'));
			const buf = await readFileBytes(p);
			assert.equal(buf.toString(), 'binary');
		});
	});
});

// ---------------------------------------------------------------------------
// walk
// ---------------------------------------------------------------------------

describe('walk', () => {
	it('yields all files recursively', async () => {
		await withTmpDir(async (dir) => {
			await writeFile(join(dir, 'a.txt'), 'a');
			await writeFile(join(dir, 'sub', 'b.txt'), 'b');
			await writeFile(join(dir, 'sub', 'deep', 'c.txt'), 'c');

			const entries: string[] = [];
			for await (const e of walk(dir)) {
				entries.push(e.relative);
			}
			entries.sort();
			assert.deepEqual(entries, ['a.txt', 'sub/b.txt', 'sub/deep/c.txt']);
		});
	});

	it('uses posix separators in relative paths', async () => {
		await withTmpDir(async (dir) => {
			await writeFile(join(dir, 'x', 'y', 'z.txt'), 'z');
			const entries: string[] = [];
			for await (const e of walk(dir)) {
				entries.push(e.relative);
			}
			assert.ok(entries.every((r) => !r.includes('\\')));
		});
	});

	it('yields absolute paths', async () => {
		await withTmpDir(async (dir) => {
			await writeFile(join(dir, 'file.txt'), 'f');
			const entries: string[] = [];
			for await (const e of walk(dir)) {
				entries.push(e.path);
			}
			assert.ok(entries.every((p) => p.startsWith('/')));
		});
	});

	it('filter predicate excludes non-matching entries', async () => {
		await withTmpDir(async (dir) => {
			await writeFile(join(dir, 'a.md'), '');
			await writeFile(join(dir, 'b.html'), '');
			await writeFile(join(dir, 'c.md'), '');

			const entries: string[] = [];
			for await (const e of walk(dir, (entry) => entry.relative.endsWith('.md'))) {
				entries.push(e.relative);
			}
			entries.sort();
			assert.deepEqual(entries, ['a.md', 'c.md']);
		});
	});

	it('returns nothing for an empty directory', async () => {
		await withTmpDir(async (dir) => {
			const entries: string[] = [];
			for await (const e of walk(dir)) {
				entries.push(e.relative);
			}
			assert.deepEqual(entries, []);
		});
	});
});

// ---------------------------------------------------------------------------
// copyDir
// ---------------------------------------------------------------------------

describe('copyDir', () => {
	it('copies all files preserving structure', async () => {
		await withTmpDir(async (dir) => {
			const src = join(dir, 'src');
			const dest = join(dir, 'dest');
			await writeFile(join(src, 'a.txt'), 'a');
			await writeFile(join(src, 'sub', 'b.txt'), 'b');

			const count = await copyDir(src, dest);
			assert.equal(count, 2);
			assert.equal(await readFile(join(dest, 'a.txt')), 'a');
			assert.equal(await readFile(join(dest, 'sub', 'b.txt')), 'b');
		});
	});

	it('returns 0 for non-existent source', async () => {
		await withTmpDir(async (dir) => {
			const count = await copyDir(join(dir, 'ghost'), join(dir, 'dest'));
			assert.equal(count, 0);
		});
	});

	it('creates dest directory if needed', async () => {
		await withTmpDir(async (dir) => {
			const src = join(dir, 'src');
			const dest = join(dir, 'a', 'b', 'dest');
			await writeFile(join(src, 'file.txt'), 'hello');
			await copyDir(src, dest);
			const s = await stat(join(dest, 'file.txt'));
			assert.ok(s.isFile());
		});
	});

	it('does not create ghost directories for root-level files', async () => {
		await withTmpDir(async (dir) => {
			const src = join(dir, 'src');
			const dest = join(dir, 'dest');
			// Root-level files with extensions should not create e.g. "favicon.sv/" or "robots.tx/"
			await writeFile(join(src, 'favicon.svg'), '<svg/>');
			await writeFile(join(src, 'robots.txt'), 'User-agent: *');
			await copyDir(src, dest);
			// Files copied correctly
			assert.equal(await readFile(join(dest, 'favicon.svg')), '<svg/>');
			assert.equal(await readFile(join(dest, 'robots.txt')), 'User-agent: *');
			// No ghost dirs like favicon.sv/ or robots.tx/
			const { readdir } = await import('node:fs/promises');
			const entries = await readdir(dest);
			assert.ok(!entries.includes('favicon.sv'), 'ghost dir favicon.sv/ must not exist');
			assert.ok(!entries.includes('robots.tx'), 'ghost dir robots.tx/ must not exist');
			assert.equal(
				entries.filter((e) => !e.includes('.')).length,
				0,
				'no directories should be created',
			);
		});
	});
});

// ---------------------------------------------------------------------------
// hashFile / hashContent
// ---------------------------------------------------------------------------

describe('hashFile', () => {
	it('returns hex sha256 of file contents', async () => {
		await withTmpDir(async (dir) => {
			const p = join(dir, 'data.txt');
			await writeFile(p, 'hello');
			const h = await hashFile(p);
			assert.match(h, /^[0-9a-f]{64}$/);
		});
	});

	it('same content → same hash', async () => {
		await withTmpDir(async (dir) => {
			const p1 = join(dir, 'a.txt');
			const p2 = join(dir, 'b.txt');
			await writeFile(p1, 'same');
			await writeFile(p2, 'same');
			assert.equal(await hashFile(p1), await hashFile(p2));
		});
	});

	it('different content → different hash', async () => {
		await withTmpDir(async (dir) => {
			const p1 = join(dir, 'a.txt');
			const p2 = join(dir, 'b.txt');
			await writeFile(p1, 'aaa');
			await writeFile(p2, 'bbb');
			assert.notEqual(await hashFile(p1), await hashFile(p2));
		});
	});

	it('throws not_found for missing file', async () => {
		await withTmpDir(async (dir) => {
			await assert.rejects(
				() => hashFile(join(dir, 'missing.txt')),
				(err: unknown) => isSiteError(err) && err.code === 'not_found',
			);
		});
	});
});

describe('hashContent', () => {
	it('returns 64 hex chars', () => {
		const h = hashContent('hello');
		assert.match(h, /^[0-9a-f]{64}$/);
	});

	it('matches hashFile for same bytes', async () => {
		await withTmpDir(async (dir) => {
			const p = join(dir, 'check.txt');
			await writeFile(p, 'abc');
			const fromFile = await hashFile(p);
			const fromContent = hashContent('abc');
			assert.equal(fromFile, fromContent);
		});
	});
});
