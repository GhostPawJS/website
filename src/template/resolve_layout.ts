import { SiteError } from '../errors.ts';

// ---------------------------------------------------------------------------
// Layout declaration format
//
// A template declares its parent layout with a single HTML comment on its
// own line (leading/trailing whitespace allowed):
//
//   <!-- layout: base.html -->
//
// The comment is stripped from the source before rendering so it never
// appears in the final HTML output.
// ---------------------------------------------------------------------------

/** Regex that matches a layout declaration comment anywhere in the template. */
const LAYOUT_RE = /^[ \t]*<!--[ \t]*layout:[ \t]*([^\s>]+)[ \t]*-->[ \t]*\n?/m;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface LayoutDeclaration {
	/** Parent layout name declared in this template, or `null` if none (root). */
	parent: string | null;
	/** Template source with the layout comment removed. */
	source: string;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse and strip the `<!-- layout: name.html -->` declaration from a
 * template source string.
 *
 * - Returns `parent: null` when no declaration is present (the template is a
 *   root layout that has no parent).
 * - The returned `source` always has the comment removed so callers can hand
 *   it straight to `render()` without the comment appearing in output.
 */
export function parseLayoutDeclaration(templateSource: string): LayoutDeclaration {
	const match = templateSource.match(LAYOUT_RE);
	if (match === null) {
		return { parent: null, source: templateSource };
	}
	return {
		parent: match[1] ?? null,
		source:
			templateSource.slice(0, match.index) +
			templateSource.slice((match.index ?? 0) + match[0].length),
	};
}

/**
 * Resolve the full layout chain for a content page.
 *
 * Starting from `startLayout` (the value of `layout:` in a page's
 * frontmatter), follows `<!-- layout: parent -->` declarations through each
 * template until reaching a root template with no layout declaration.
 *
 * Returns the chain ordered **outermost-first** (root → … → immediate parent
 * of the page content), which is the order the build pipeline should apply
 * `{{{ content }}}` slots:
 *
 * ```
 * resolveLayoutChain("post.html", resolver)
 * // → ["base.html", "page.html", "post.html"]
 * //     ↑ rendered last (outermost wrapper)
 * //                          ↑ rendered first (closest to content)
 * ```
 *
 * @param startLayout  Name of the template declared by the page (e.g. `"post.html"`).
 * @param getTemplate  Callback that returns a template's raw source by name,
 *                     or `null`/`undefined` if not found.
 * @throws `SiteError('not_found')` when a declared layout template is missing.
 * @throws `SiteError('conflict')` when a circular layout reference is detected.
 */
export function resolveLayoutChain(
	startLayout: string,
	getTemplate: (name: string) => string | null | undefined,
): string[] {
	const chain: string[] = [];
	const visited = new Set<string>();
	let current: string | null = startLayout;

	while (current !== null) {
		if (visited.has(current)) {
			throw new SiteError(
				'conflict',
				`Circular layout reference detected: ${[...visited].join(' → ')} → ${current}`,
			);
		}
		visited.add(current);

		const source = getTemplate(current);
		if (source == null) {
			throw new SiteError('not_found', `Layout template not found: "${current}"`);
		}

		// Prepend so that when the loop ends, chain[0] is the outermost root
		chain.unshift(current);

		const { parent } = parseLayoutDeclaration(source);
		current = parent;
	}

	return chain;
}
