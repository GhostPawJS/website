/**
 * Browser globals injection — injected by esbuild so it runs before any module.
 * Sets up Buffer and process shims that memfs and its dependencies expect.
 */
import { Buffer as NodeBuffer } from 'buffer';

type GlobalsExtension = {
	Buffer: typeof NodeBuffer;
	process: {
		env: { NODE_ENV: string };
		platform: string;
		version: string;
		versions: Record<string, unknown>;
		cwd: () => string;
		nextTick: (fn: () => void) => void;
	};
};

const g = globalThis as typeof globalThis & Partial<GlobalsExtension>;

// Make Buffer available as a global (memfs uses it internally)
if (!g.Buffer) {
	g.Buffer = NodeBuffer;
}

// Minimal process shim
if (!g.process) {
	g.process = {
		env: { NODE_ENV: 'production' },
		platform: 'browser',
		version: 'v24.0.0',
		versions: {},
		cwd: () => '/',
		nextTick: (fn: () => void) => Promise.resolve().then(fn),
	};
}
