// ---------------------------------------------------------------------------
// Shared types for @ghostpaw/website
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Site configuration (site.json)
// ---------------------------------------------------------------------------

export interface SiteConfig {
	name: string;
	url: string;
	language: string;
	description?: string;
	author?: string;
	fitness?: FitnessConfig;
	[key: string]: unknown;
}

export interface FitnessConfig {
	voice?: VoiceConfig;
}

export interface VoiceConfig {
	bannedWords?: string[];
	bannedPhrases?: string[];
	readabilityMin?: number;
	readabilityMax?: number;
	burstinessMin?: number;
	hedgingMaxPercent?: number;
	transitionMaxPercent?: number;
}

// ---------------------------------------------------------------------------
// Project paths
// ---------------------------------------------------------------------------

export interface ProjectPaths {
	/** Absolute path to the project root (contains site.json). */
	root: string;
	siteJson: string;
	domainMd: string;
	personaMd: string;
	assets: string;
	templates: string;
	content: string;
	data: string;
	dist: string;
	buildManifest: string;
	fitnessHistory: string;
}

// ---------------------------------------------------------------------------
// Page frontmatter
// ---------------------------------------------------------------------------

export interface PageFrontmatter {
	title?: string;
	description?: string;
	/** Layout template filename, e.g. "page.html". */
	layout?: string;
	date?: string;
	dateModified?: string;
	author?: string;
	/** Primary keyword/keyphrase for SEO. */
	keyword?: string;
	/** Path or URL to Open Graph image. */
	og_image?: string;
	noindex?: boolean;
	nofollow?: boolean;
	/** Schema.org @type, e.g. "Article", "FAQPage". */
	schema_type?: string;
	/** Override collection grouping (defaults to parent dir). */
	collection?: string;
	/** Sort weight within a collection (lower = earlier). */
	weight?: number;
	[key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Content page (parsed, before render)
// ---------------------------------------------------------------------------

export interface ContentPage {
	/** Absolute path to source .md file. */
	file: string;
	/** URL-relative slug without leading slash, e.g. "blog/first-post". */
	slug: string;
	/** URL path with trailing slash, e.g. "/blog/first-post/". */
	url: string;
	frontmatter: PageFrontmatter;
	/** Markdown body after frontmatter is stripped. */
	body: string;
	/** Directory-based collection name, or null for root pages. */
	collection: string | null;
}

// ---------------------------------------------------------------------------
// Rendered page (after full template + layout execution)
// ---------------------------------------------------------------------------

export interface RenderedPage {
	/** Absolute path to source .md file. */
	file: string;
	slug: string;
	url: string;
	frontmatter: PageFrontmatter;
	/** Full rendered HTML string (complete document). */
	html: string;
	/** Plain text stripped from HTML (for fitness analysis). */
	textContent: string;
	wordCount: number;
}

// ---------------------------------------------------------------------------
// Build manifest
// ---------------------------------------------------------------------------

export interface ManifestEntry {
	/** SHA-256 hex hash of source file content. */
	hash: string;
	/** Source file mtime as Unix ms timestamp. */
	mtime: number;
	url: string;
}

export interface BuildManifest {
	version: 1;
	timestamp: number;
	/**
	 * SHA-256 of all template + data file paths and mtimes (sorted).
	 * Changes when any template or data file is added, removed, or modified.
	 * A mismatch triggers a full rebuild even in incremental mode.
	 */
	sourceFingerprint: string;
	pages: Record<string, ManifestEntry>;
}

// ---------------------------------------------------------------------------
// Build result
// ---------------------------------------------------------------------------

export interface BuildResult {
	pages: RenderedPage[];
	/** Number of pages skipped (not re-rendered) in an incremental build. */
	skipped: number;
	manifest: BuildManifest;
	/** Fitness report — null until fitness() is called separately. */
	fitness: null;
	duration: number;
}

// ---------------------------------------------------------------------------
// Fitness system types
// ---------------------------------------------------------------------------

export type IssueSeverity = 'error' | 'warning' | 'info';

export type FixAction =
	| 'set_frontmatter'
	| 'add_content'
	| 'update_content'
	| 'update_template'
	| 'add_asset'
	| 'create_file'
	| 'merge_into'
	| 'redirect'
	| 'remove';

export interface FixSuggestion {
	file: string;
	action: FixAction;
	field?: string;
	value?: string;
	target?: string;
}

export interface Issue {
	severity: IssueSeverity;
	dimension: string;
	code: string;
	message: string;
	page: string;
	element?: string;
	current?: string;
	expected?: string;
	fix?: FixSuggestion;
}

export interface ReadabilityScores {
	fleschReadingEase: number;
	fleschKincaidGrade: number;
	gunningFog: number;
	avgSentenceLength: number;
	avgSyllablesPerWord: number;
}

export interface DimensionScore {
	score: number;
	passed: number;
	failed: number;
	issues: Issue[];
}

export interface PageScore {
	url: string;
	score: number;
	issues: Issue[];
	readability: ReadabilityScores;
	wordCount: number;
	tfidfTopTerms: string[];
}

export interface CannibalizationPair {
	pageA: string;
	pageB: string;
	similarity: number;
	cosineSim: number;
	titleSim: number;
	descSim: number;
	sharedTerms: string[];
	suggestion: 'merge' | 'differentiate' | 'redirect' | 'review';
}

export interface TopicalCluster {
	id: string;
	pillar?: string;
	pages: string[];
	coherence: number;
	missingPillar: boolean;
	orphans: string[];
}

export interface DryRunDiff {
	before: { overall: number; pages: Record<string, number> };
	after: { overall: number; pages: Record<string, number> };
	newCannibalization: CannibalizationPair[];
	resolvedCannibalization: CannibalizationPair[];
	affectedPages: string[];
}

export interface FitnessReport {
	timestamp: number;
	overall: number;
	dimensions: Record<string, DimensionScore>;
	pages: Record<string, PageScore>;
	clusters: TopicalCluster[];
	cannibalization: CannibalizationPair[];
	dryRun?: DryRunDiff;
}

export interface FitnessHistoryEntry {
	timestamp: number;
	overall: number;
	dimensions: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Public API types
// ---------------------------------------------------------------------------

export interface PageSummary {
	/** Relative file path from project root, e.g. "content/blog/post.md". */
	path: string;
	url: string;
	frontmatter: PageFrontmatter;
	wordCount: number;
	readability: ReadabilityScores;
	collection: string | null;
}

export interface PageDetail extends PageSummary {
	/** Raw markdown body (frontmatter stripped). */
	markdown: string;
	/** Full rendered HTML document. */
	html: string;
	tfidfTopTerms: string[];
}

export interface TemplateSummary {
	name: string;
	parent: string | null;
	chain: string[];
}

export interface DataSummary {
	name: string;
	/** Top-level keys, or ["[array]"] for array data files. */
	shape: string[];
}

export interface AssetSummary {
	/** Path relative to assets/ root. */
	path: string;
	absolutePath: string;
	/** Corresponding path under dist/. */
	mountPath: string;
	mimeType: string;
	size: number;
}

export interface AssetDetail extends AssetSummary {
	/** Content of text assets. */
	content?: string;
	/** SHA-256 hex of binary assets. */
	hash?: string;
}

export interface SiteStructure {
	/** url → parent url (null for homepage). */
	hierarchy: Record<string, string | null>;
	/** url → outgoing internal urls. */
	links: Record<string, string[]>;
	/** collection name → page urls. */
	collections: Record<string, string[]>;
	clusters: TopicalCluster[];
}

export type DryRunChange =
	| { kind: 'write_page'; path: string; frontmatter: PageFrontmatter; content: string }
	| { kind: 'delete_page'; path: string }
	| { kind: 'write_template'; path: string; content: string }
	| { kind: 'delete_template'; path: string }
	| { kind: 'write_data'; path: string; content: string }
	| { kind: 'delete_data'; path: string }
	| { kind: 'write_config'; content: Partial<SiteConfig> }
	| { kind: 'write_asset'; path: string; content: string | Buffer }
	| { kind: 'delete_asset'; path: string };

export interface DryRunResult {
	before: FitnessReport;
	after: FitnessReport;
	diff: DryRunDiff;
}

export interface ServeOptions {
	port?: number;
	host?: string;
	/** Auto-open browser on start. Default: false. */
	open?: boolean;
	/** Inject livereload. Default: true. */
	livereload?: boolean;
	/** Skip the initial build on startup (caller builds separately). */
	skipInitialBuild?: boolean;
	/** Called after each successful incremental rebuild. */
	onRebuild?: (result: BuildResult) => void;
	/** Called when a rebuild fails. */
	onError?: (err: Error) => void;
}

export interface ServeInstance {
	dir: string;
	port: number;
	host: string;
	url: string;
}

export interface FitnessOptions {
	/** Limit run to specific dimension IDs. Omit to run all. */
	dimensions?: string[];
	/** Optional GSC/Bing data to activate the search_console analyzer. */
	searchConsole?: GscData;
}

// ---------------------------------------------------------------------------
// Search Console / external performance data
// ---------------------------------------------------------------------------

export interface GscRow {
	/** URL path (e.g. "/blog/post/"). */
	page: string;
	query: string;
	clicks: number;
	impressions: number;
	ctr: number;
	position: number;
	/** ISO date string for time-series analysis (optional). */
	date?: string;
}

export interface GscData {
	rows: GscRow[];
	/** Human-readable period label, e.g. "2024-01-01/2024-03-31". */
	period?: string;
}

export interface PageFilter {
	collection?: string;
	/** URL prefix match. */
	url?: string;
}

export interface AssetFilter {
	/** MIME type prefix match, e.g. "image/". */
	mimeType?: string;
	/** Path prefix match on relative path. */
	path?: string;
}
