import { defineCommand } from 'citty';
import * as api from '../../api/index.ts';
import { requireProject } from '../detect.ts';
import { formatFitnessReport, formatPageScore } from '../format/fitness.ts';

export default defineCommand({
	meta: { name: 'check', description: 'Run the fitness report across all 19 analyzers' },
	args: {
		page: {
			type: 'string',
			description: 'Scope to a single page URL (e.g. /about/)',
			default: '',
		},
		json: { type: 'boolean', description: 'Output raw JSON', default: false },
	},
	async run({ args }) {
		const cwd = await requireProject();

		if (args.page) {
			// Single-page mode
			const score = await api.read.fitnessPage(cwd, args.page);
			if (args.json) {
				console.log(JSON.stringify(score, null, 2));
			} else {
				console.log(formatPageScore(score));
			}
			// Exit 1 if errors present (useful in CI)
			const hasErrors = score.issues.some((i) => i.severity === 'error');
			if (hasErrors) process.exit(1);
			return;
		}

		// Full site fitness
		const report = await api.read.fitness(cwd);

		if (args.json) {
			console.log(JSON.stringify(report, null, 2));
		} else {
			const config = await api.read.getConfig(cwd);
			console.log(formatFitnessReport(report, config.name));
		}

		// Exit 1 if any error-severity issues found
		const hasErrors = Object.values(report.dimensions)
			.flatMap((d) => d.issues)
			.some((i) => i.severity === 'error');
		if (hasErrors) process.exit(1);
	},
});
