import { access, readFile, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineCommand } from 'citty';
import * as api from '../../api/index.ts';
import { c, fatal, fmtMs } from '../output.ts';

export default defineCommand({
	meta: { name: 'init', description: 'Create a new website project' },
	args: {
		dir: {
			type: 'positional',
			description: 'Directory to create the site in (default: current dir)',
			required: false,
			default: '',
		},
		name: { type: 'string', description: 'Site name (default: directory name)', default: '' },
		url: { type: 'string', description: 'Site URL', default: 'http://localhost:3000' },
		lang: { type: 'string', description: 'Language BCP 47 tag', default: 'en' },
		force: { type: 'boolean', description: 'Allow re-init in an existing project', default: false },
	},
	async run({ args }) {
		const targetDir = resolve(args.dir || '.');
		const siteName = args.name || basename(targetDir) || 'My Site';

		// Guard: stop if already a project (unless --force)
		if (!args.force) {
			try {
				await access(join(targetDir, 'site.json'));
				fatal(
					`${targetDir} is already a @ghostpaw/website project.\n\n` +
						`  Use --force to re-initialise.`,
				);
			} catch {
				// Not yet a project — good.
			}
		}

		// Scaffold the project structure
		await api.build.scaffold(targetDir, { name: siteName, url: args.url, language: args.lang });

		// Copy SKILL.md from package root into the project so agents can find it
		try {
			const pkgRoot = fileURLToPath(new URL('../../../', import.meta.url));
			const skill = await readFile(join(pkgRoot, 'SKILL.md'), 'utf8');
			await writeFile(join(targetDir, 'SKILL.md'), skill);
		} catch {
			// Not fatal — SKILL.md may not exist in a dev environment
		}

		// Write (or merge) package.json with project scripts
		await writeProjectPackageJson(targetDir, siteName);

		// Initial build
		const start = Date.now();
		await api.build.build(targetDir);
		const duration = Date.now() - start;

		// Output
		const rel = targetDir === process.cwd() ? '.' : basename(targetDir);
		console.log('');
		console.log(`  ${c.bold('@ghostpaw/website')} — new site created`);
		console.log('');
		console.log(`  ${rel}/`);
		console.log(`  ├── site.json          ${c.dim('← set your real URL and site name here')}`);
		console.log(`  ├── DOMAIN.md          ${c.dim('← describe what this site is about')}`);
		console.log(`  ├── PERSONA.md         ${c.dim('← define voice and style')}`);
		console.log(`  ├── content/           ${c.dim('your pages live here')}`);
		console.log(`  ├── templates/         ${c.dim('HTML building blocks')}`);
		console.log(`  ├── assets/            ${c.dim('CSS, images, fonts — copied as-is')}`);
		console.log(`  └── dist/              ${c.dim('build output — never edit directly')}`);
		console.log('');
		console.log(`  First build  ${c.green('2 pages')} · ${c.dim(fmtMs(duration))}`);
		console.log('');

		const prefix = targetDir !== process.cwd() ? `cd ${basename(targetDir)}\n    ` : '';
		console.log(`  Next steps:`);
		console.log(`    ${prefix}npm run dev`);
		console.log('');
	},
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function writeProjectPackageJson(dir: string, name: string): Promise<void> {
	const pkgPath = join(dir, 'package.json');
	let pkg: Record<string, unknown> = {};

	try {
		const raw = await readFile(pkgPath, 'utf8');
		pkg = JSON.parse(raw) as Record<string, unknown>;
	} catch {
		// No package.json yet — start fresh
		pkg = {
			name: name.toLowerCase().replace(/\s+/g, '-'),
			version: '0.1.0',
			private: true,
		};
	}

	// Merge scripts without overwriting ones the user already set
	const scripts = (pkg.scripts as Record<string, string>) ?? {};
	scripts.dev ??= 'website dev';
	scripts.build ??= 'website build';
	scripts.check ??= 'website check';
	scripts.start ??= 'website start';
	pkg.scripts = scripts;

	// Add @ghostpaw/website to devDependencies if absent
	const devDeps = (pkg.devDependencies as Record<string, string>) ?? {};
	devDeps['@ghostpaw/website'] ??= 'latest';
	pkg.devDependencies = devDeps;

	await writeFile(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
}
