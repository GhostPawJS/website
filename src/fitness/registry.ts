// ---------------------------------------------------------------------------
// Analyzer registry — ordered list of all analyzers.
//
// Tier 1 (always-on):   seo_meta, seo_structure, content_quality, images,
//                       links, social, sitemap_robots, technical
// Tier 2 (TF-IDF):      cannibalization, topical_clusters, content_tfidf
// Tier 3 (schema/lang): schema_validation, geo, eeat, local_seo,
//                       multilingual, voice_compliance
// Tier 4 (conditional): search_console
// ---------------------------------------------------------------------------

import { cannibalization } from './analyzers/cannibalization.ts';
import { contentQuality } from './analyzers/content_quality.ts';
import { contentTfidf } from './analyzers/content_tfidf.ts';
import { eeat } from './analyzers/eeat.ts';
import { geo } from './analyzers/geo.ts';
import { images } from './analyzers/images.ts';
import { links } from './analyzers/links.ts';
import { localSeo } from './analyzers/local_seo.ts';
import { multilingual } from './analyzers/multilingual.ts';
import { schemaValidation } from './analyzers/schema_validation.ts';
import { searchConsole } from './analyzers/search_console.ts';
import { seoMeta } from './analyzers/seo_meta.ts';
import { seoStructure } from './analyzers/seo_structure.ts';
import { sitemapRobots } from './analyzers/sitemap_robots.ts';
import { social } from './analyzers/social.ts';
import { technical } from './analyzers/technical.ts';
import { topicalClusters } from './analyzers/topical_clusters.ts';
import { voiceCompliance } from './analyzers/voice_compliance.ts';
import type { Analyzer } from './types.ts';

export const ANALYZERS: readonly Analyzer[] = [
	// Tier 1 — always applied
	seoMeta,
	seoStructure,
	contentQuality,
	images,
	links,
	social,
	sitemapRobots,
	technical,
	// Tier 2 — TF-IDF / multi-page intelligence
	cannibalization,
	topicalClusters,
	contentTfidf,
	// Tier 3 — schema-aware / content signals
	schemaValidation,
	geo,
	eeat,
	localSeo,
	multilingual,
	voiceCompliance,
	// Tier 4 — external data / optional
	searchConsole,
];
