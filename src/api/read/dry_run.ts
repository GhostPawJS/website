// ---------------------------------------------------------------------------
// dryRun — preview the fitness impact of proposed changes without writing
// to disk.
//
// Applies changes to in-memory copies of the content/template/data/config
// state, re-renders, re-runs fitness, and diffs the results.
// ---------------------------------------------------------------------------

import { parsePageSource } from '../../content/parse_page.ts';
import { pageOrder } from '../../content/url_routing.ts';
import { fitness as runFitness } from '../../fitness/runner.ts';
import { resolvePaths } from '../../project/paths.ts';
import { renderPage } from '../../render/render_page.ts';
import type {
	CannibalizationPair,
	ContentPage,
	DryRunChange,
	DryRunDiff,
	DryRunResult,
	FitnessReport,
	SiteConfig,
} from '../../types.ts';
import { serializeFrontmatter } from '../../yaml/serialize.ts';
import { renderAll } from './_render.ts';

/**
 * Preview the fitness impact of one or more proposed changes.
 *
 * Changes are applied in order to in-memory state — no files are written.
 * Returns the before/after fitness reports and a structured diff.
 */
export async function dryRun(dir: string, changes: DryRunChange[]): Promise<DryRunResult> {
	const paths = resolvePaths(dir);
	const base = await renderAll(dir);

	// Run baseline fitness (read from the already-rendered state)
	const before = await runFitness(base.pages, base.config, paths);

	// --- Apply mutations to in-memory copies ---
	let mutConfig: SiteConfig = { ...base.config };
	let mutContentPages: ContentPage[] = [...base.contentPages];
	const mutTemplates = new Map(base.templates);
	const mutData = { ...base.data };

	for (const change of changes) {
		switch (change.kind) {
			case 'write_config': {
				mutConfig = { ...mutConfig, ...change.content };
				break;
			}
			case 'write_page': {
				// Build the markdown source string with frontmatter
				const fmText = serializeFrontmatter(change.frontmatter as Record<string, unknown>);
				const source = fmText ? `---\n${fmText}\n---\n${change.content}` : change.content;
				// Derive a fake relative path for URL routing
				const relPath = change.path.startsWith('content/')
					? change.path.slice('content/'.length)
					: change.path;
				const fakePath = `${paths.content}/${relPath}`;
				const parsed = parsePageSource(
					source,
					fakePath,
					relPath.endsWith('.md') ? relPath : `${relPath}.md`,
				);
				// Replace or append
				const existingIdx = mutContentPages.findIndex((p) => p.file === fakePath);
				if (existingIdx >= 0) {
					mutContentPages[existingIdx] = parsed;
				} else {
					mutContentPages = [...mutContentPages, parsed];
				}
				mutContentPages.sort(pageOrder);
				break;
			}
			case 'delete_page': {
				const relPath = change.path.startsWith('content/')
					? change.path.slice('content/'.length)
					: change.path;
				const fakePath = `${paths.content}/${relPath}`;
				mutContentPages = mutContentPages.filter((p) => p.file !== fakePath);
				break;
			}
			case 'write_template': {
				mutTemplates.set(change.path, change.content);
				break;
			}
			case 'delete_template': {
				mutTemplates.delete(change.path);
				break;
			}
			case 'write_data': {
				try {
					const key = change.path.replace(/\.json$/, '').replace(/\//g, '_');
					mutData[key] = JSON.parse(change.content);
				} catch {
					// malformed JSON — skip
				}
				break;
			}
			case 'delete_data': {
				const key = change.path.replace(/\.json$/, '').replace(/\//g, '_');
				delete mutData[key];
				break;
			}
			// write_asset / delete_asset don't affect rendering
			case 'write_asset':
			case 'delete_asset':
				break;
		}
	}

	// Re-render with mutated state
	const buildTimestamp = Date.now();
	const mutPages = await Promise.all(
		mutContentPages.map((p) =>
			renderPage(p, mutConfig, mutContentPages, mutTemplates, mutData, buildTimestamp),
		),
	);

	const after = await runFitness(mutPages, mutConfig, paths);
	const diff = computeDiff(before, after);

	return { before, after, diff };
}

// ---------------------------------------------------------------------------
// Diff computation
// ---------------------------------------------------------------------------

function computeDiff(before: FitnessReport, after: FitnessReport): DryRunDiff {
	const beforePages = Object.fromEntries(
		Object.entries(before.pages).map(([url, ps]) => [url, ps.score]),
	);
	const afterPages = Object.fromEntries(
		Object.entries(after.pages).map(([url, ps]) => [url, ps.score]),
	);

	const affectedPages = Object.keys(afterPages).filter(
		(url) => Math.abs((afterPages[url] ?? 0) - (beforePages[url] ?? 0)) > 0.001,
	);

	const newCannibalization = after.cannibalization.filter(
		(p) => !before.cannibalization.some((b) => pairKey(b) === pairKey(p)),
	);
	const resolvedCannibalization = before.cannibalization.filter(
		(p) => !after.cannibalization.some((a) => pairKey(a) === pairKey(p)),
	);

	return {
		before: { overall: before.overall, pages: beforePages },
		after: { overall: after.overall, pages: afterPages },
		newCannibalization,
		resolvedCannibalization,
		affectedPages,
	};
}

function pairKey(p: CannibalizationPair): string {
	const [a, b] = [p.pageA, p.pageB].sort();
	return `${a}\0${b}`;
}
