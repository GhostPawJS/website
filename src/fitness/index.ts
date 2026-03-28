// ---------------------------------------------------------------------------
// Public API for the fitness system.
// ---------------------------------------------------------------------------

export { buildSiteContext } from './context.ts';
export { ANALYZERS } from './registry.ts';
export { fitness } from './runner.ts';
export { computeDimensionScore, computeOverallScore, computePageScores } from './score.ts';
export type { Analyzer, CheckResult, SiteContext } from './types.ts';
