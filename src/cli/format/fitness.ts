import type { FitnessReport, FixSuggestion, Issue, PageScore } from '../../types.ts';
import { bar, c, scoreColor } from '../output.ts';

/** Format a full FitnessReport for terminal display. */
export function formatFitnessReport(report: FitnessReport, siteName?: string): string {
	const lines: string[] = [''];

	const header = siteName ? `Fitness Report — ${siteName}` : 'Fitness Report';
	lines.push(`  ${c.bold(header)}`);
	lines.push(`  ${c.dim('─'.repeat(52))}`);
	lines.push(`  Overall  ${scoreColor(report.overall, `${report.overall}/100`)}`);
	lines.push('');

	// Dimensions — sorted worst first so problems are visible immediately
	lines.push('  Dimensions');
	const dims = Object.entries(report.dimensions).sort((a, b) => a[1].score - b[1].score);
	for (const [id, dim] of dims) {
		const errors = dim.issues.filter((i) => i.severity === 'error').length;
		const warns = dim.issues.filter((i) => i.severity === 'warning').length;
		const tag =
			errors > 0
				? c.red(`  ${errors} error${errors > 1 ? 's' : ''}`)
				: warns > 0
					? c.yellow(`  ${warns} warning${warns > 1 ? 's' : ''}`)
					: '';
		const name = c.dim(id.padEnd(22));
		lines.push(
			`  ${name}  ${scoreColor(dim.score, String(dim.score).padStart(3))}  ${bar(dim.score)}${tag}`,
		);
	}

	// Collect all non-info issues
	const allIssues: Issue[] = [];
	for (const dim of Object.values(report.dimensions)) {
		allIssues.push(...dim.issues.filter((i) => i.severity !== 'info'));
	}
	const errors = allIssues.filter((i) => i.severity === 'error');
	const warnings = allIssues.filter((i) => i.severity === 'warning');

	if (allIssues.length === 0) {
		lines.push('');
		lines.push(`  ${c.green('No errors or warnings — site is healthy.')}`);
	} else {
		const counts = [
			errors.length > 0 ? c.red(`${errors.length} error${errors.length !== 1 ? 's' : ''}`) : '',
			warnings.length > 0
				? c.yellow(`${warnings.length} warning${warnings.length !== 1 ? 's' : ''}`)
				: '',
		]
			.filter(Boolean)
			.join(c.dim(' · '));
		lines.push('');
		lines.push(`  Issues  ${c.dim(`${allIssues.length} total`)} — ${counts}`);

		for (const issue of [...errors, ...warnings]) {
			lines.push('');
			const sev = issue.severity === 'error' ? c.red('ERROR') : c.yellow('WARN ');
			lines.push(`  ${sev}  ${c.cyan(issue.page)}  ${c.dim(issue.dimension)}`);
			lines.push(`         ${issue.message}`);
			if (issue.fix) {
				lines.push(`         ${c.dim('Fix:')} ${describeFix(issue.fix)}`);
				if (issue.fix.file) {
					lines.push(`         ${c.dim('→')} ${issue.fix.file}`);
				}
			}
		}
	}

	lines.push('');
	lines.push(`  ${c.dim('─'.repeat(52))}`);
	lines.push(`  ${c.dim('Run `website check --json` for machine-readable output.')}`);
	lines.push('');

	return lines.join('\n');
}

/** Format a single PageScore for terminal display. */
export function formatPageScore(score: PageScore): string {
	const lines: string[] = [''];
	lines.push(`  ${c.bold(`Page Score — ${score.url}`)}`);
	lines.push(`  ${c.dim('─'.repeat(52))}`);
	lines.push(`  Score  ${scoreColor(score.score, `${score.score}/100`)}  ${bar(score.score)}`);
	lines.push('');
	lines.push(`  Words      ${score.wordCount}`);
	lines.push(
		`  Readability  Flesch ${score.readability.fleschReadingEase.toFixed(0)} · FK Grade ${score.readability.fleschKincaidGrade.toFixed(1)}`,
	);
	if (score.tfidfTopTerms.length > 0) {
		lines.push(`  Top terms  ${score.tfidfTopTerms.slice(0, 8).join(', ')}`);
	}

	const issues = score.issues.filter((i) => i.severity !== 'info');
	if (issues.length > 0) {
		lines.push('');
		for (const issue of issues) {
			const sev = issue.severity === 'error' ? c.red('ERROR') : c.yellow('WARN ');
			lines.push(`  ${sev}  ${c.dim(issue.dimension)}`);
			lines.push(`         ${issue.message}`);
			if (issue.fix?.file) lines.push(`         ${c.dim('→')} ${issue.fix.file}`);
		}
	} else {
		lines.push('');
		lines.push(`  ${c.green('No issues found.')}`);
	}
	lines.push('');
	return lines.join('\n');
}

function describeFix(fix: FixSuggestion): string {
	if (fix.action === 'set_frontmatter' && fix.field) {
		return `set ${c.dim(fix.field)}${fix.value ? ` to ${c.dim(`"${fix.value}"`)}` : ''} in frontmatter`;
	}
	if (fix.action === 'add_content') return 'add content to the page body';
	if (fix.action === 'update_content') return 'update the page content';
	if (fix.action === 'update_template') return 'update the template file';
	if (fix.action === 'merge_into') return fix.target ? `merge into ${fix.target}` : 'merge pages';
	if (fix.action === 'redirect')
		return fix.target ? `redirect to ${fix.target}` : 'set up redirect';
	return fix.action.replace(/_/g, ' ');
}
