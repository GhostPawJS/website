import { isSiteError, SiteError } from '../errors.ts';
import { readFile } from '../fs/read_file.ts';
import { walk } from '../fs/walk.ts';
import { render as renderTemplate } from '../template/render.ts';
import { parseLayoutDeclaration, resolveLayoutChain } from '../template/resolve_layout.ts';
import type { ContentPage, RenderedPage, SiteConfig } from '../types.ts';
import { buildHeadInjection, injectHead } from './auto_inject.ts';
import { countWords, renderMarkdown, stripHtml } from './markdown.ts';
import { buildTemplateContext } from './template_context.ts';

/** A map of template name → raw template source. */
export type TemplateMap = Map<string, string>;

/**
 * Load all `.html` files from `templatesDir` into a TemplateMap.
 */
export async function loadTemplates(templatesDir: string): Promise<TemplateMap> {
	const map: TemplateMap = new Map();
	try {
		for await (const entry of walk(templatesDir, (e) => e.relative.endsWith('.html'))) {
			const src = await readFile(entry.path);
			map.set(entry.relative, src);
		}
	} catch (err) {
		if (isSiteError(err) && err.code === 'not_found') return map;
	}
	return map;
}

/**
 * Render a single `ContentPage` to a `RenderedPage`.
 *
 * Steps:
 * 1. Render Markdown body to HTML
 * 2. Resolve layout chain from frontmatter `layout` field
 * 3. Build template context
 * 4. Apply each layout in the chain (innermost first), slotting {{{ content }}}
 * 5. Auto-inject canonical/OG/meta into <head>
 */
export async function renderPage(
	page: ContentPage,
	config: SiteConfig,
	allPages: ContentPage[],
	templates: TemplateMap,
	data: Record<string, unknown>,
	buildTimestamp: number,
): Promise<RenderedPage> {
	// 1. Markdown → HTML
	const bodyHtml = renderMarkdown(page.body);

	// 2. Resolve layout chain  (`layout:` is canonical; `template:` is accepted as alias)
	const layoutName = page.frontmatter.layout
		? String(page.frontmatter.layout)
		: page.frontmatter.template
			? String(page.frontmatter.template)
			: null;
	let html = bodyHtml;

	if (layoutName) {
		const getTemplate = (name: string): string | null => templates.get(name) ?? null;
		let chain: string[];
		try {
			chain = resolveLayoutChain(layoutName, getTemplate);
		} catch (err) {
			throw new SiteError(
				'build',
				`Layout resolution failed for "${page.file}": ${err instanceof Error ? err.message : String(err)}`,
			);
		}

		// 3. Build context
		const ctx = buildTemplateContext(page, config, allPages, data, buildTimestamp);

		// Partial resolver
		const partials: Record<string, string> = {};
		for (const [name, src] of templates) {
			const { source } = parseLayoutDeclaration(src);
			partials[name] = source;
		}

		// 4. Walk chain innermost → outermost
		// chain is outermost-first, so we iterate in reverse
		for (let i = chain.length - 1; i >= 0; i--) {
			const name = chain[i];
			if (!name) continue;
			const rawTemplate = templates.get(name);
			if (!rawTemplate) continue;
			const { source: templateSource } = parseLayoutDeclaration(rawTemplate);
			const layerCtx = { ...ctx, content: html };
			html = renderTemplate(templateSource, layerCtx, partials);
		}
	}

	// 5. Auto-inject head tags
	const headHtml = buildHeadInjection(page, config);
	html = injectHead(html, headHtml);

	const textContent = stripHtml(html);
	const wordCount = countWords(textContent);

	return {
		file: page.file,
		slug: page.slug,
		url: page.url,
		frontmatter: page.frontmatter,
		html,
		textContent,
		wordCount,
	};
}
