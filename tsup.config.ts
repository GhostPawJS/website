import { defineConfig } from 'tsup';

export default defineConfig([
	// Library — ESM + CJS with types
	{
		entry: ['src/index.ts'],
		format: ['esm', 'cjs'],
		dts: true,
		clean: true,
		target: 'node24',
		splitting: false,
		sourcemap: false,
		treeshake: true,
	},
	// CLI binary — ESM only, shebang, no types, fully self-contained
	{
		entry: { website: 'src/cli/index.ts' },
		format: ['esm'],
		dts: false,
		clean: false,
		target: 'node24',
		splitting: false,
		sourcemap: false,
		treeshake: true,
		banner: { js: '#!/usr/bin/env node' },
		outDir: 'dist',
		noExternal: [/.*/],
	},
]);
