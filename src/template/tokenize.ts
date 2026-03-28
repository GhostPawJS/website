import { SiteError } from '../errors.ts';

// ---------------------------------------------------------------------------
// Token types
// ---------------------------------------------------------------------------

export type Token =
	| { type: 'text'; value: string }
	| { type: 'var'; path: string } // {{ path }} — HTML-escaped
	| { type: 'raw'; path: string } // {{{ path }}} — raw HTML
	| { type: 'partial'; name: string } // {{> "name" }}
	| { type: 'each_open'; collection: string; alias: string } // {{#each items as item}}
	| { type: 'each_close' } // {{/each}}
	| { type: 'if_open'; condition: string } // {{#if condition}}
	| { type: 'else' } // {{else}}
	| { type: 'if_close' }; // {{/if}}

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

/**
 * Tokenize a Mustache-inspired template string into a flat list of tokens.
 *
 * Supported syntax:
 * - `{{ path }}`              HTML-escaped variable (dot notation)
 * - `{{{ path }}}`            Raw HTML variable
 * - `{{> "partial.html" }}`   Partial include
 * - `{{#each col as item}}`   Iteration open
 * - `{{/each}}`               Iteration close
 * - `{{#if condition}}`       Conditional open (supports `!negation`)
 * - `{{else}}`                Else branch
 * - `{{/if}}`                 Conditional close
 */
export function tokenize(template: string): Token[] {
	const tokens: Token[] = [];

	// Match {{{ ... }}} before {{ ... }} to avoid consuming the extra brace
	const tagRe = /(\{\{\{[\s\S]*?\}\}\}|\{\{[\s\S]*?\}\})/g;
	let lastIndex = 0;

	for (const match of template.matchAll(tagRe)) {
		const start = match.index;

		// Text between the previous tag and this one
		if (start > lastIndex) {
			tokens.push({ type: 'text', value: template.slice(lastIndex, start) });
		}

		const tag = match[0];
		const token = parseTag(tag);
		if (token !== null) tokens.push(token);

		lastIndex = start + tag.length;
	}

	// Trailing text after the last tag
	if (lastIndex < template.length) {
		tokens.push({ type: 'text', value: template.slice(lastIndex) });
	}

	return tokens;
}

// ---------------------------------------------------------------------------
// Tag parser
// ---------------------------------------------------------------------------

function parseTag(tag: string): Token | null {
	// {{{ raw }}}
	if (tag.startsWith('{{{')) {
		const inner = tag.slice(3, -3).trim();
		if (!isValidPath(inner)) {
			throw new SiteError('validation', `Template: invalid path in {{{ }}} tag: "${inner}"`);
		}
		return { type: 'raw', path: inner };
	}

	const inner = tag.slice(2, -2).trim();
	if (inner === '') return null; // {{}} — silently ignore

	// {{> "partial.html" }} or {{> partial.html }}
	if (inner.startsWith('>')) {
		const name = inner
			.slice(1)
			.trim()
			.replace(/^["']|["']$/g, '');
		if (name === '') {
			throw new SiteError('validation', `Template: empty partial name in tag: "${tag}"`);
		}
		return { type: 'partial', name };
	}

	// {{#each collection as alias}}
	if (inner.startsWith('#each')) {
		const rest = inner.slice(5).trim();
		const asIdx = rest.lastIndexOf(' as ');
		if (asIdx === -1) {
			throw new SiteError('validation', `Template: {{#each}} requires "as" alias, got: "${tag}"`);
		}
		const collection = rest.slice(0, asIdx).trim();
		const alias = rest.slice(asIdx + 4).trim();
		if (!collection || !alias) {
			throw new SiteError('validation', `Template: invalid {{#each}} syntax in: "${tag}"`);
		}
		return { type: 'each_open', collection, alias };
	}

	// {{/each}}
	if (inner === '/each') return { type: 'each_close' };

	// {{#if condition}}
	if (inner.startsWith('#if')) {
		const condition = inner.slice(3).trim();
		if (!condition) {
			throw new SiteError('validation', `Template: empty condition in {{#if}}: "${tag}"`);
		}
		return { type: 'if_open', condition };
	}

	// {{else}}
	if (inner === 'else') return { type: 'else' };

	// {{/if}}
	if (inner === '/if') return { type: 'if_close' };

	// {{ path }} — variable
	if (!isValidPath(inner)) {
		throw new SiteError('validation', `Template: invalid variable path: "${inner}"`);
	}
	return { type: 'var', path: inner };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * A valid path is a dot-separated list of identifiers, optionally prefixed
 * with `!` for negation (used in `{{#if !flag}}`).
 */
function isValidPath(s: string): boolean {
	const clean = s.startsWith('!') ? s.slice(1) : s;
	return /^[a-zA-Z_$][a-zA-Z0-9_$]*(\.[a-zA-Z_$][a-zA-Z0-9_$]*)*$/.test(clean);
}
