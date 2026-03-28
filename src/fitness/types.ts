// ---------------------------------------------------------------------------
// Fitness-system-internal types (supplement src/types.ts shared types).
// ---------------------------------------------------------------------------

import type { GscData, Issue, ProjectPaths, RenderedPage, SiteConfig } from '../types.ts';
import type { LanguageKit } from './language.ts';
import type { LinkGraph } from './link_graph.ts';
import type { TfidfIndex } from './tfidf.ts';

// ---------------------------------------------------------------------------
// Site context (assembled once, shared across all analyzers)
// ---------------------------------------------------------------------------

export interface SiteContext {
	pages: RenderedPage[];
	/** O(1) lookup: set of all page URLs. */
	pageSet: Set<string>;
	linkGraph: LinkGraph;
	tfidf: TfidfIndex;
	config: SiteConfig;
	paths: ProjectPaths;
	domain: string;
	persona: string;
	language: LanguageKit;
	/** Content of dist/sitemap.xml — empty string if not found. */
	sitemapXml: string;
	/** Content of dist/robots.txt — empty string if not found. */
	robotsTxt: string;
	/** Optional GSC/Bing performance data — activates search_console analyzer. */
	searchConsole?: GscData;
}

// ---------------------------------------------------------------------------
// Analyzer interface
// ---------------------------------------------------------------------------

/**
 * A single check result.
 * - `pass: true` — the check passed, no issue.
 * - `pass: false` — the check failed; `issue` carries the details.
 */
export type CheckResult = { pass: true } | { pass: false; issue: Issue };

/** Helper to create a failing check. */
export function fail(issue: Issue): CheckResult {
	return { pass: false, issue };
}

/** Helper to record a passing check. */
export const pass: CheckResult = { pass: true };

export interface Analyzer {
	/** Unique machine-readable identifier. */
	id: string;
	/** Human-readable dimension name (maps to DimensionScore key). */
	dimension: string;
	/**
	 * Relative weight for the overall score computation.
	 * Higher = more impact on the overall score.
	 */
	weight: number;
	/**
	 * Gate function — if it returns false the analyzer is skipped entirely
	 * for this site (e.g. no schema data present, GSC not configured).
	 */
	applies: (ctx: SiteContext) => boolean;
	/**
	 * Run all checks for this dimension.
	 * Returns one CheckResult per discrete check performed.
	 * The runner counts pass/fail and extracts issues.
	 */
	analyze: (ctx: SiteContext) => CheckResult[];
}
