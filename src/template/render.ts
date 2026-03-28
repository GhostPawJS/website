import { SiteError } from '../errors.ts';
import type { Token } from './tokenize.ts';
import { tokenize } from './tokenize.ts';

// ---------------------------------------------------------------------------
// AST types
// ---------------------------------------------------------------------------

type AstNode =
	| { type: 'text'; value: string }
	| { type: 'var'; path: string }
	| { type: 'raw'; path: string }
	| { type: 'partial'; name: string }
	| { type: 'each'; collection: string; alias: string; body: AstNode[] }
	| { type: 'if'; condition: string; consequent: AstNode[]; alternate: AstNode[] };

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolver function for partial templates.
 * Receives the partial name (e.g. `"nav.html"`) and must return the raw
 * template source string, or `undefined` / `null` if not found.
 */
export type PartialResolver = (name: string) => string | null | undefined;

/**
 * Render a Mustache-inspired template against a context object.
 *
 * @param template   Raw template source string.
 * @param ctx        Data context — plain object, dot-notation paths are resolved.
 * @param partials   Either a `Record<string, string>` map or a resolver function.
 *                   Missing partials produce an empty string (no throw).
 * @returns          Rendered HTML string.
 */
export function render(
	template: string,
	ctx: Record<string, unknown>,
	partials: Record<string, string> | PartialResolver = {},
): string {
	const tokens = tokenize(template);
	const ast = buildAst(tokens);
	const resolve = normalizeResolver(partials);
	return renderNodes(ast, ctx, resolve);
}

// ---------------------------------------------------------------------------
// AST builder
// ---------------------------------------------------------------------------

interface TokenCtx {
	tokens: Token[];
	pos: number;
}

function buildAst(tokens: Token[]): AstNode[] {
	const ctx: TokenCtx = { tokens, pos: 0 };
	return parseNodes(ctx, () => false);
}

function parseNodes(tokenCtx: TokenCtx, stopAt: (t: Token) => boolean): AstNode[] {
	const nodes: AstNode[] = [];

	while (tokenCtx.pos < tokenCtx.tokens.length) {
		const token = tokenCtx.tokens[tokenCtx.pos];
		if (token === undefined) break;
		if (stopAt(token)) break;

		tokenCtx.pos++;

		switch (token.type) {
			case 'text':
				// Coalesce consecutive text tokens (shouldn't happen from tokenizer,
				// but defensive merge is free)
				nodes.push({ type: 'text', value: token.value });
				break;

			case 'var':
				nodes.push({ type: 'var', path: token.path });
				break;

			case 'raw':
				nodes.push({ type: 'raw', path: token.path });
				break;

			case 'partial':
				nodes.push({ type: 'partial', name: token.name });
				break;

			case 'each_open': {
				const body = parseNodes(tokenCtx, (t) => t.type === 'each_close');
				expectToken(tokenCtx, 'each_close', `{{#each ${token.collection} as ${token.alias}}}`);
				nodes.push({ type: 'each', collection: token.collection, alias: token.alias, body });
				break;
			}

			case 'if_open': {
				const consequent = parseNodes(tokenCtx, (t) => t.type === 'else' || t.type === 'if_close');
				let alternate: AstNode[] = [];
				const peek = tokenCtx.tokens[tokenCtx.pos];
				if (peek?.type === 'else') {
					tokenCtx.pos++; // consume {{else}}
					alternate = parseNodes(tokenCtx, (t) => t.type === 'if_close');
				}
				expectToken(tokenCtx, 'if_close', `{{#if ${token.condition}}}`);
				nodes.push({
					type: 'if',
					condition: token.condition,
					consequent,
					alternate,
				});
				break;
			}

			case 'each_close':
			case 'if_close':
			case 'else':
				// The stopAt predicate should have caught these; if we reach here
				// they are unmatched — throw a meaningful error.
				throw new SiteError(
					'validation',
					`Template: unexpected {{${token.type === 'each_close' ? '/each' : token.type === 'if_close' ? '/if' : 'else'}}} without matching open tag`,
				);
		}
	}

	return nodes;
}

function expectToken(tokenCtx: TokenCtx, type: Token['type'], openTag: string): void {
	const t = tokenCtx.tokens[tokenCtx.pos];
	if (t?.type !== type) {
		throw new SiteError(
			'validation',
			`Template: unclosed ${openTag} — expected {{${type === 'each_close' ? '/each' : '/if'}}}`,
		);
	}
	tokenCtx.pos++;
}

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

function renderNodes(
	nodes: AstNode[],
	ctx: Record<string, unknown>,
	resolve: PartialResolver,
): string {
	let out = '';
	for (const node of nodes) {
		out += renderNode(node, ctx, resolve);
	}
	return out;
}

function renderNode(node: AstNode, ctx: Record<string, unknown>, resolve: PartialResolver): string {
	switch (node.type) {
		case 'text':
			return node.value;

		case 'var': {
			const val = resolvePath(ctx, node.path);
			return htmlEscape(stringify(val));
		}

		case 'raw': {
			const val = resolvePath(ctx, node.path);
			return stringify(val);
		}

		case 'partial': {
			const source = resolve(node.name);
			if (source == null) return ''; // missing partial → silent empty
			// Render the partial with the same context; it may include its own tags
			return render(source, ctx, resolve);
		}

		case 'each': {
			const items = resolvePath(ctx, node.collection);
			if (!Array.isArray(items)) return '';
			const len = items.length;
			return items
				.map((item, index) => {
					const childCtx: Record<string, unknown> = {
						...ctx,
						[node.alias]: item,
						[`${node.alias}__index`]: index,
						[`${node.alias}__first`]: index === 0,
						[`${node.alias}__last`]: index === len - 1,
					};
					return renderNodes(node.body, childCtx, resolve);
				})
				.join('');
		}

		case 'if': {
			const isNegated = node.condition.startsWith('!');
			const path = isNegated ? node.condition.slice(1) : node.condition;
			const val = resolvePath(ctx, path);
			const truthy = isNegated ? !isTruthy(val) : isTruthy(val);
			return truthy
				? renderNodes(node.consequent, ctx, resolve)
				: renderNodes(node.alternate, ctx, resolve);
		}
	}
}

// ---------------------------------------------------------------------------
// Context helpers
// ---------------------------------------------------------------------------

/**
 * Resolve a dot-notation path against a context object.
 * Returns `undefined` if any segment is missing or the parent is not an object.
 */
export function resolvePath(ctx: Record<string, unknown>, path: string): unknown {
	const parts = path.split('.');
	let current: unknown = ctx;

	for (const part of parts) {
		if (current === null || current === undefined) return undefined;
		if (typeof current !== 'object') return undefined;
		current = (current as Record<string, unknown>)[part];
	}

	return current;
}

/**
 * Convert a value to a string for template output.
 * `null` and `undefined` render as empty string.
 */
function stringify(val: unknown): string {
	if (val === null || val === undefined) return '';
	if (typeof val === 'string') return val;
	return String(val);
}

/**
 * Escape HTML special characters for safe `{{ }}` output.
 */
export function htmlEscape(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

/**
 * Truthy check for template conditions.
 * Empty arrays, empty strings, 0, null, undefined, and false are falsy.
 */
export function isTruthy(val: unknown): boolean {
	if (val === null || val === undefined || val === false) return false;
	if (typeof val === 'string') return val !== '';
	if (typeof val === 'number') return val !== 0 && !Number.isNaN(val);
	if (Array.isArray(val)) return val.length > 0;
	return true;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function normalizeResolver(partials: Record<string, string> | PartialResolver): PartialResolver {
	if (typeof partials === 'function') return partials;
	return (name: string) => partials[name] ?? null;
}
