import { join } from 'node:path';
import { writeFile } from '../fs/write_file.ts';
import { DOMAIN_TEMPLATE, writeDomain } from '../project/domain.ts';
import { resolvePaths } from '../project/paths.ts';
import { PERSONA_TEMPLATE, writePersona } from '../project/persona.ts';
import { defaultSiteConfig, writeSiteConfig } from '../project/site_config.ts';
import {
	ABOUT_MD,
	BASE_HTML,
	BLOG_HTML,
	BREADCRUMB_HTML,
	FAQ_HTML,
	FAVICON_SVG,
	FOOTER_HTML,
	INDEX_MD,
	NAV_HTML,
	NAV_JSON,
	PAGE_HTML,
	POST_HTML,
	ROBOTS_TXT,
	STYLE_CSS,
	TABLE_HTML,
} from './scaffold_templates.ts';

export interface ScaffoldOptions {
	name?: string;
	url?: string;
	language?: string;
}

/**
 * Bootstrap a new project directory from scratch.
 * Idempotent: existing files are NOT overwritten.
 */
export async function scaffold(projectDir: string, options: ScaffoldOptions = {}): Promise<void> {
	const siteName = options.name ?? 'My Site';
	const siteUrl = options.url ?? 'http://localhost:3000';
	const lang = options.language ?? 'en';

	const paths = resolvePaths(projectDir);

	// site.json
	const config = { ...defaultSiteConfig(siteName), url: siteUrl, language: lang };
	await writeSiteConfig(paths.siteJson, config);

	// DOMAIN.md / PERSONA.md
	await writeDomain(paths.domainMd, DOMAIN_TEMPLATE);
	await writePersona(paths.personaMd, PERSONA_TEMPLATE);

	// templates/
	const t = paths.templates;
	await writeFile(join(t, 'base.html'), BASE_HTML);
	await writeFile(join(t, 'page.html'), PAGE_HTML);
	await writeFile(join(t, 'post.html'), POST_HTML);
	await writeFile(join(t, 'nav.html'), NAV_HTML);
	await writeFile(join(t, 'footer.html'), FOOTER_HTML);
	await writeFile(join(t, 'blog.html'), BLOG_HTML);
	// Building-block templates with Schema.org baked in
	await writeFile(join(t, 'faq.html'), FAQ_HTML);
	await writeFile(join(t, 'breadcrumb.html'), BREADCRUMB_HTML);
	await writeFile(join(t, 'table.html'), TABLE_HTML);

	// assets/
	const a = paths.assets;
	await writeFile(join(a, 'css', 'style.css'), STYLE_CSS);
	await writeFile(join(a, 'robots.txt'), ROBOTS_TXT.replace(/{SITE_URL}/g, siteUrl));
	await writeFile(join(a, 'favicon.svg'), FAVICON_SVG);
	await writeFile(join(a, 'images', '.gitkeep'), '');

	// data/
	await writeFile(join(paths.data, 'nav.json'), NAV_JSON);

	// content/
	const c = paths.content;
	await writeFile(join(c, 'index.md'), INDEX_MD.replace(/{SITE_NAME}/g, siteName));
	await writeFile(join(c, 'about.md'), ABOUT_MD.replace(/{SITE_NAME}/g, siteName));
}
