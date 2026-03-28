import { SiteError } from '../../errors.ts';
import { resolvePaths } from '../../project/paths.ts';
import { loadTemplates } from '../../render/render_page.ts';
import { parseLayoutDeclaration, resolveLayoutChain } from '../../template/resolve_layout.ts';
import type { TemplateSummary } from '../../types.ts';

/** Return a summary of every template (name, parent layout, full chain). */
export async function listTemplates(dir: string): Promise<TemplateSummary[]> {
	const paths = resolvePaths(dir);
	const templates = await loadTemplates(paths.templates);
	return buildSummaries(templates);
}

/**
 * Return the raw source of a named template.
 * Throws `SiteError('not_found')` if the template does not exist.
 */
export async function getTemplate(dir: string, name: string): Promise<string> {
	const paths = resolvePaths(dir);
	const templates = await loadTemplates(paths.templates);
	const src = templates.get(name);
	if (src === undefined) throw new SiteError('not_found', `Template not found: "${name}"`);
	return src;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildSummaries(templates: Map<string, string>): TemplateSummary[] {
	const getTemplate = (name: string): string | null => templates.get(name) ?? null;
	const summaries: TemplateSummary[] = [];

	for (const [name, src] of templates) {
		const { parent } = parseLayoutDeclaration(src);
		let chain: string[] = [];
		try {
			// Only pages have a starting layout; templates are the layouts themselves.
			// Resolve chain as if this template were a content page's layout.
			chain = resolveLayoutChain(name, getTemplate);
		} catch {
			chain = [name];
		}
		summaries.push({ name, parent, chain });
	}

	summaries.sort((a, b) => a.name.localeCompare(b.name));
	return summaries;
}
