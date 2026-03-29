import { defineCommand } from 'citty';
import * as api from '../../api/index.ts';
import { requireProject } from '../detect.ts';
import { c, fmtMs, scoreColor } from '../output.ts';

export default defineCommand({
	meta: { name: 'dev', description: 'Start dev server with file watching and livereload' },
	args: {
		port: { type: 'string', description: 'Port number', default: '3000' },
		open: { type: 'boolean', description: 'Open browser after start', default: false },
	},
	async run({ args }) {
		const cwd = await requireProject();
		const port = parseInt(args.port, 10) || 3000;

		console.log('');
		console.log(`  ${c.bold('@ghostpaw/website dev')}`);
		console.log('');

		// Do the initial build ourselves so we can show timing + fitness score
		const buildResult = await api.build.build(cwd);
		const report = await api.read.fitness(cwd);
		const config = await api.read.getConfig(cwd);

		// Start the server (skipInitialBuild — we just built)
		let instance: Awaited<ReturnType<typeof api.build.serve>>;
		try {
			instance = await api.build.serve(cwd, {
				port,
				livereload: true,
				skipInitialBuild: true,
				onRebuild: (result) => {
					const time = timestamp();
					const pages = result.pages.length + result.skipped;
					console.log(`  ${c.dim(time)}  rebuilt ${c.dim(fmtMs(result.duration))} · ${pages} pages`);
				},
				onError: (err) => {
					const time = timestamp();
					console.error(`  ${c.dim(time)}  ${c.red('build error')}`);
					// Show only the first line — build errors are usually concise
					const msg = err.message.split('\n')[0] ?? err.message;
					console.error(`  ${c.dim('         ')}  ${msg}`);
				},
			});
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			// Port in use is the most common failure — give a specific hint
			if (msg.includes('EADDRINUSE')) {
				console.error(`\n  ${c.red('Port')} ${port} ${c.red('is already in use.')}`);
				console.error(`  Try: website dev --port ${port + 1}\n`);
				process.exit(1);
			}
			throw err;
		}

		// Ready banner
		const issueCount = Object.values(report.dimensions).flatMap((d) => d.issues).filter((i) => i.severity !== 'info')
			.length;
		const scoreStr = `${report.overall}/100`;
		const issueStr =
			issueCount > 0
				? c.dim(` — ${issueCount} issue${issueCount > 1 ? 's' : ''} (run \`website check\`)`)
				: '';

		console.log(`  Local:    ${c.cyan(instance.url)}`);
		console.log(`  Project:  ${c.dim(config.name)}`);
		console.log(`  Fitness:  ${scoreColor(report.overall, scoreStr)}${issueStr}`);
		console.log(`  Pages:    ${buildResult.pages.length + buildResult.skipped}`);
		console.log('');
		console.log(`  ${c.dim('Watching content/, templates/, data/, assets/')}`);
		console.log(`  ${c.dim('Ctrl+C to stop')}`);
		console.log('');

		if (args.open) {
			// Lazy-require open — not a hard dep
			import('node:child_process')
				.then(({ exec }) => exec(`open ${instance.url}`))
				.catch(() => {});
		}

		// Graceful shutdown on Ctrl+C
		process.once('SIGINT', async () => {
			console.log('');
			await api.build.stop(cwd).catch(() => {});
			process.exit(0);
		});

		// Keep alive
		await new Promise(() => {});
	},
});

function timestamp(): string {
	return new Date().toLocaleTimeString('en-GB', {
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
	});
}
