import { defineCommand } from 'citty';
import * as api from '../../api/index.ts';
import { resolvePaths } from '../../project/paths.ts';
import { requireProject } from '../detect.ts';
import { c, fmtMs, scoreColor } from '../output.ts';
import { precompress } from '../server/precompress.ts';

export default defineCommand({
	meta: { name: 'build', description: 'Build the site to dist/' },
	args: {
		threshold: {
			type: 'string',
			description: 'Exit 1 if fitness score is below this value (for CI)',
			default: '',
		},
		json: {
			type: 'boolean',
			description: 'Output raw JSON (BuildResult + FitnessReport)',
			default: false,
		},
	},
	async run({ args }) {
		const cwd = await requireProject();

		if (!args.json) {
			console.log('');
			console.log(`  ${c.bold('@ghostpaw/website build')}`);
			console.log('');
		}

		// Build
		const result = await api.build.build(cwd);

		// Pre-compress dist/ so `website start` can serve .gz files without runtime overhead
		const { dist } = resolvePaths(cwd);
		await precompress(dist);

		// Fitness (renders pages again — separated from build by design)
		const report = await api.read.fitness(cwd);

		if (args.json) {
			console.log(JSON.stringify({ build: result, fitness: report }, null, 2));
			return;
		}

		const pageCount = result.pages.length + result.skipped;
		console.log(`  ${pageCount} pages · ${fmtMs(result.duration)} · ${c.dim('dist/ ready')}`);
		console.log('');

		// Fitness summary — show worst dimensions first
		console.log(`  Fitness  ${scoreColor(report.overall, `${report.overall}/100`)}`);
		const dims = Object.entries(report.dimensions).sort((a, b) => a[1].score - b[1].score);
		const shown = dims.slice(0, 5);
		for (const [id, dim] of shown) {
			const issues = dim.issues.filter((i) => i.severity !== 'info');
			const tag =
				issues.length > 0 ? c.dim(`  ← ${issues.length} issue${issues.length > 1 ? 's' : ''}`) : '';
			const connector =
				shown.indexOf([id, dim] as (typeof shown)[number]) === shown.length - 1 ? '└──' : '├──';
			console.log(
				`  ${c.dim(connector)} ${id.padEnd(22)} ${scoreColor(dim.score, String(dim.score))}${tag}`,
			);
		}
		if (dims.length > 5) {
			const rest = dims.length - 5;
			console.log(`  ${c.dim(`    (${rest} more dimension${rest > 1 ? 's' : ''} — all passing)`)}`);
		}

		console.log('');
		console.log(`  ${c.dim('Run `website check` for the full issue report.')}`);
		console.log('');

		// CI threshold exit code
		const threshold = args.threshold ? parseInt(args.threshold, 10) : null;
		if (threshold !== null && !isNaN(threshold) && report.overall < threshold) {
			console.error(
				c.red(`  Fitness ${report.overall} is below threshold ${threshold}. Failing build.`),
			);
			process.exit(1);
		}
	},
});
