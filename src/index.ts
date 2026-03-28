// Errors

// High-level API namespaces
export * as api from './api/index.ts';

export * as build from './build/index.ts';
// Top-level convenience re-exports
export { build as buildSite, scaffold } from './build/index.ts';
export * as content from './content/index.ts';
export type { SiteErrorCode } from './errors.ts';
export { isSiteError, SiteError } from './errors.ts';
// Fitness system
export * as fitness from './fitness/index.ts';
export { fitness as runFitness } from './fitness/index.ts';
// Build pipeline layers
export * as fs from './fs/index.ts';
export * as project from './project/index.ts';
export * as render from './render/index.ts';
// LLM integration surface
export * as skills from './skills/index.ts';
export * as soul from './soul/index.ts';
export * as template from './template/index.ts';
export * as tools from './tools/index.ts';
// Shared types
export type {
	AssetDetail,
	AssetFilter,
	AssetSummary,
	BuildManifest,
	BuildResult,
	CannibalizationPair,
	ContentPage,
	DataSummary,
	DimensionScore,
	DryRunChange,
	DryRunDiff,
	DryRunResult,
	FitnessConfig,
	FitnessHistoryEntry,
	FitnessOptions,
	FitnessReport,
	FixAction,
	FixSuggestion,
	GscData,
	GscRow,
	Issue,
	IssueSeverity,
	ManifestEntry,
	PageDetail,
	PageFilter,
	PageFrontmatter,
	PageScore,
	PageSummary,
	ProjectPaths,
	ReadabilityScores,
	RenderedPage,
	ServeInstance,
	ServeOptions,
	SiteConfig,
	SiteStructure,
	TemplateSummary,
	TopicalCluster,
	VoiceConfig,
} from './types.ts';
// Internal engines — re-exported for library consumers who need direct access
export * as yaml from './yaml/index.ts';
