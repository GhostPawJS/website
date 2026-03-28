import { fitness as runFitness } from '../../fitness/runner.ts';
import { appendFitnessHistory, loadFitnessHistory } from '../../project/fitness_history.ts';
import { resolvePaths } from '../../project/paths.ts';
import type { FitnessHistoryEntry, FitnessOptions, FitnessReport, PageScore } from '../../types.ts';
import { renderAll } from './_render.ts';

/**
 * Run the fitness system on the project.
 * Appends a history entry to `.fitness-history.json` on each call.
 *
 * If `opts.dimensions` is provided, only the specified analyzer dimensions
 * are scored (others are omitted from the report). Full context is still built.
 */
export async function fitness(dir: string, opts?: FitnessOptions): Promise<FitnessReport> {
	const { pages, config, paths } = await renderAll(dir);
	const report = await runFitness(pages, config, paths, opts?.searchConsole);

	// Optionally scope to requested dimensions
	const scoped = opts?.dimensions?.length ? scopeReport(report, opts.dimensions) : report;

	// Persist history entry
	const entry: FitnessHistoryEntry = {
		timestamp: scoped.timestamp,
		overall: scoped.overall,
		dimensions: Object.fromEntries(Object.entries(scoped.dimensions).map(([k, v]) => [k, v.score])),
	};
	await appendFitnessHistory(paths.fitnessHistory, entry);

	return scoped;
}

/**
 * Run fitness checks for a single page only.
 *
 * Only Tier 1 (always-on) and Tier 3 (schema/content-signal) analyzers run —
 * multi-page Tier 2 analyzers (TF-IDF, cannibalization, clusters) are skipped
 * since they require the full corpus.
 *
 * Does NOT append to fitness history.
 */
export async function fitnessPage(dir: string, path: string): Promise<PageScore> {
	const { pages, config, paths } = await renderAll(dir);

	// Find the target page
	const page = pages.find((p) => p.url === path || p.file.endsWith(path) || p.slug === path);
	if (!page) {
		const { SiteError } = await import('../../errors.ts');
		throw new SiteError('not_found', `Page not found: "${path}"`);
	}

	// Run fitness on just this one page — Tier 2 analyzers will be skipped
	// since single-page TF-IDF has no comparative signal
	const report = await runFitness([page], config, paths);
	const score = report.pages[page.url];

	if (!score) {
		return {
			url: page.url,
			score: 0,
			issues: [],
			readability: {
				fleschReadingEase: 0,
				fleschKincaidGrade: 0,
				gunningFog: 0,
				avgSentenceLength: 0,
				avgSyllablesPerWord: 0,
			},
			wordCount: page.wordCount,
			tfidfTopTerms: [],
		};
	}

	return score;
}

/** Return the fitness score history from `.fitness-history.json`. */
export async function fitnessHistory(dir: string): Promise<FitnessHistoryEntry[]> {
	const paths = resolvePaths(dir);
	return loadFitnessHistory(paths.fitnessHistory);
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function scopeReport(report: FitnessReport, dimensions: string[]): FitnessReport {
	const dimSet = new Set(dimensions);
	const filteredDimensions = Object.fromEntries(
		Object.entries(report.dimensions).filter(([k]) => dimSet.has(k)),
	);
	const filteredPages = Object.fromEntries(
		Object.entries(report.pages).map(([url, ps]) => [
			url,
			{ ...ps, issues: ps.issues.filter((i) => dimSet.has(i.dimension)) },
		]),
	);
	return { ...report, dimensions: filteredDimensions, pages: filteredPages };
}
