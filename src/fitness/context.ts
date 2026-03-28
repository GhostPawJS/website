import { isSiteError } from '../errors.ts';
import { readFile } from '../fs/read_file.ts';
import type { GscData, ProjectPaths, RenderedPage, SiteConfig } from '../types.ts';
import { getMetaName, getTitle } from './html_parser.ts';
import { getLanguageKit } from './language.ts';
import { buildLinkGraph } from './link_graph.ts';
import { buildTfidf } from './tfidf.ts';
import type { SiteContext } from './types.ts';

/**
 * Assemble a full SiteContext from rendered pages, config, and project paths.
 *
 * Build order:
 * 1. Language kit (from config.language)
 * 2. TF-IDF index (requires tokenizer from language kit)
 * 3. Link graph (independent of TF-IDF)
 * 4. Load domain + persona from disk
 */
export async function buildSiteContext(
	pages: RenderedPage[],
	config: SiteConfig,
	paths: ProjectPaths,
	searchConsole?: GscData,
): Promise<SiteContext> {
	const language = getLanguageKit(config.language);

	// Build TF-IDF inputs from rendered pages
	const tfidfInputs = pages.map((p) => ({
		url: p.url,
		text: p.textContent,
		title: getTitle(p.html) || (p.frontmatter.title ? String(p.frontmatter.title) : ''),
		description:
			getMetaName(p.html, 'description') ||
			(p.frontmatter.description ? String(p.frontmatter.description) : ''),
	}));

	// Build TF-IDF + link graph in parallel
	const [tfidf, linkGraph] = await Promise.all([
		Promise.resolve(buildTfidf(tfidfInputs, language.tokenize)),
		Promise.resolve(
			buildLinkGraph(
				pages.map((p) => ({ url: p.url, html: p.html })),
				config.url,
			),
		),
	]);

	// Load DOMAIN.md, PERSONA.md, sitemap.xml, robots.txt (all graceful)
	const { join } = await import('node:path');
	const [domain, persona, sitemapXml, robotsTxt] = await Promise.all([
		loadOptional(paths.domainMd),
		loadOptional(paths.personaMd),
		loadOptional(join(paths.dist, 'sitemap.xml')),
		loadOptional(join(paths.dist, 'robots.txt')),
	]);

	const pageSet = new Set(pages.map((p) => p.url));

	return {
		pages,
		pageSet,
		linkGraph,
		tfidf,
		config,
		paths,
		domain,
		persona,
		language,
		sitemapXml,
		robotsTxt,
		...(searchConsole ? { searchConsole } : {}),
	};
}

async function loadOptional(filePath: string): Promise<string> {
	try {
		return await readFile(filePath);
	} catch (err) {
		if (isSiteError(err) && err.code === 'not_found') return '';
		return '';
	}
}
