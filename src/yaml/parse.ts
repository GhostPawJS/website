import { SiteError } from '../errors.ts';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

// Interfaces break the circular-reference restriction for recursive type aliases.
export interface YamlObject {
	[key: string]: YamlValue;
}
export type YamlValue = string | number | boolean | null | YamlValue[] | YamlObject;
export type YamlMap = YamlObject;

export interface FrontmatterResult {
	data: YamlMap;
	body: string;
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface ContentLine {
	/** Number of leading spaces (tabs expanded to 2 spaces). */
	indent: number;
	/** Line content after stripping the leading whitespace. */
	content: string;
	/** 0-based index into the rawLines array — used for block scalar collection. */
	rawIdx: number;
}

interface ParseCtx {
	contentLines: ContentLine[];
	rawLines: string[];
	/** Current position in contentLines. */
	pos: number;
}

// ---------------------------------------------------------------------------
// Entry points
// ---------------------------------------------------------------------------

/**
 * Extract YAML frontmatter from a markdown file's raw content.
 *
 * Accepts files that begin with `---` (with optional trailing whitespace).
 * If no valid front-matter block is found, returns `{ data: {}, body: input }`.
 */
export function extractFrontmatter(fileContent: string): FrontmatterResult {
	// Normalize CRLF so all downstream logic only sees \n
	const normalized = fileContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

	if (!normalized.startsWith('---')) {
		return { data: {}, body: normalized };
	}

	const afterOpen = normalized.indexOf('\n');
	if (afterOpen === -1) return { data: {}, body: normalized };

	const rest = normalized.slice(afterOpen + 1);

	// Find the closing --- on its own line
	const closeMatch = rest.match(/^(---[ \t]*)$/m);
	if (closeMatch?.index == null) return { data: {}, body: fileContent };

	const yamlSource = rest.slice(0, closeMatch.index);
	const body = rest.slice(closeMatch.index + closeMatch[0].length).replace(/^\n/, '');

	return {
		data: parse(yamlSource),
		body,
	};
}

/**
 * Parse a raw YAML string (already stripped of `---` delimiters) into a plain
 * JavaScript object.  Supports the frontmatter subset only:
 *
 * - Scalars: unquoted / single-quoted / double-quoted strings, integers,
 *   floats, booleans (`true`/`false`/`yes`/`no`/`on`/`off`), null (`null`/`~`)
 * - Block mappings (key: value)
 * - Block sequences (`- item`)
 * - Inline sequences (`[a, b, c]`)
 * - Nested mappings and sequences
 * - Sequences of objects
 * - Literal block scalars (`|`, `|-`, `|+`)
 * - Folded block scalars (`>`, `>-`, `>+`)
 * - Inline comments (`# ...`)
 *
 * Does NOT support: anchors/aliases, merge keys, explicit tags, multi-document,
 * complex keys, or inline mappings (`{a: b}`).
 */
export function parse(input: string): YamlMap {
	// Normalize CRLF so indentation counts are consistent
	const normalized = input.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
	if (normalized.trim() === '') return {};

	const rawLines = normalized.split('\n');
	const contentLines = buildContentLines(rawLines);

	const ctx: ParseCtx = { contentLines, rawLines, pos: 0 };
	return parseMapping(ctx, 0);
}

// ---------------------------------------------------------------------------
// Preprocessing
// ---------------------------------------------------------------------------

function buildContentLines(rawLines: string[]): ContentLine[] {
	const result: ContentLine[] = [];

	for (let i = 0; i < rawLines.length; i++) {
		// Expand tabs → 2 spaces to keep indentation consistent
		const expanded = (rawLines[i] ?? '').replace(/\t/g, '  ');
		const trimmed = expanded.trimStart();

		// Skip completely empty lines and comment-only lines
		if (trimmed === '' || trimmed.startsWith('#')) continue;

		result.push({
			indent: expanded.length - trimmed.length,
			content: trimmed,
			rawIdx: i,
		});
	}

	return result;
}

// ---------------------------------------------------------------------------
// Core parsers
// ---------------------------------------------------------------------------

function parseMapping(ctx: ParseCtx, minIndent: number): YamlMap {
	const obj: YamlMap = {};

	while (ctx.pos < ctx.contentLines.length) {
		const line = ctx.contentLines[ctx.pos];
		if (line === undefined) break;

		// De-indented: belongs to a parent context
		if (line.indent < minIndent) break;

		// Over-indented inside a mapping: should not happen with valid YAML
		if (line.indent > minIndent) break;

		// A sequence item at this indent means caller mis-classified
		if (isSequenceItem(line.content)) break;

		const colonIdx = findUnquotedColon(line.content);
		if (colonIdx === -1) {
			throw new SiteError(
				'validation',
				`YAML: expected "key: value" at line ${line.rawIdx + 1}, got: "${line.content}"`,
			);
		}

		const key = line.content.slice(0, colonIdx).trim();
		if (key === '') {
			throw new SiteError('validation', `YAML: empty key at line ${line.rawIdx + 1}`);
		}

		const valueStr = line.content.slice(colonIdx + 1).trim();
		ctx.pos++;

		obj[key] = parseValue(ctx, valueStr, line);
	}

	return obj;
}

function parseSequence(ctx: ParseCtx, minIndent: number): YamlValue[] {
	const arr: YamlValue[] = [];

	while (ctx.pos < ctx.contentLines.length) {
		const line = ctx.contentLines[ctx.pos];
		if (line === undefined) break;
		if (line.indent < minIndent) break;
		if (line.indent > minIndent) break;
		if (!isSequenceItem(line.content)) break;

		ctx.pos++;
		arr.push(parseSequenceItem(ctx, line));
	}

	return arr;
}

function parseSequenceItem(ctx: ParseCtx, itemLine: ContentLine): YamlValue {
	// Strip "- " prefix (or bare "-")
	const raw = itemLine.content;
	const itemContent = raw === '-' ? '' : raw.slice(2).trim();

	if (itemContent === '' || itemContent === null) {
		// No inline value — next indented lines form the item's value
		return parseBlockItem(ctx, itemLine);
	}

	// Block scalar attached to sequence item: "- |" or "- >"
	if (itemContent === '|' || itemContent === '|-' || itemContent === '|+') {
		const chomping = chompingFromIndicator(itemContent);
		return parseLiteralBlock(ctx, itemLine, chomping);
	}
	if (itemContent === '>' || itemContent === '>-' || itemContent === '>+') {
		const chomping = chompingFromIndicator(itemContent);
		return parseFoldedBlock(ctx, itemLine, chomping);
	}

	// Inline key: value — start of an inline mapping object
	const colonIdx = findUnquotedColon(itemContent);
	if (colonIdx !== -1) {
		return parseSequenceObject(ctx, itemLine, itemContent, colonIdx);
	}

	// Plain scalar
	return parseInlineValue(itemContent);
}

/** Handle a sequence item with no inline content (empty "- " or bare "-"). */
function parseBlockItem(ctx: ParseCtx, itemLine: ContentLine): YamlValue {
	const next = ctx.contentLines[ctx.pos];
	if (next === undefined || next.indent <= itemLine.indent) return null;

	if (isSequenceItem(next.content)) {
		return parseSequence(ctx, next.indent);
	}
	return parseMapping(ctx, next.indent);
}

/**
 * Parse a sequence item that begins with an inline key-value pair, then
 * optionally continues with more key-value pairs on subsequent lines.
 *
 * Example:
 *   - name: foo      ← itemLine, itemContent = "name: foo"
 *     tags:          ← continuation at objectIndent
 *       - a
 */
function parseSequenceObject(
	ctx: ParseCtx,
	itemLine: ContentLine,
	itemContent: string,
	colonIdx: number,
): YamlMap {
	const firstKey = itemContent.slice(0, colonIdx).trim();
	const firstValueStr = itemContent.slice(colonIdx + 1).trim();

	// We cannot call parseValue for the first pair because the block-scalar
	// case needs to reference itemLine as the "current" line; we handle
	// the simple (non-block-scalar) case here and rely on object continuation
	// for the rest.
	const obj: YamlMap = {};

	if (firstValueStr === '|' || firstValueStr === '|-' || firstValueStr === '|+') {
		obj[firstKey] = parseLiteralBlock(ctx, itemLine, chompingFromIndicator(firstValueStr));
	} else if (firstValueStr === '>' || firstValueStr === '>-' || firstValueStr === '>+') {
		obj[firstKey] = parseFoldedBlock(ctx, itemLine, chompingFromIndicator(firstValueStr));
	} else if (firstValueStr === '') {
		// Block sub-value
		const next = ctx.contentLines[ctx.pos];
		if (next !== undefined && next.indent > itemLine.indent) {
			if (isSequenceItem(next.content)) {
				obj[firstKey] = parseSequence(ctx, next.indent);
			} else {
				obj[firstKey] = parseMapping(ctx, next.indent);
			}
		} else {
			obj[firstKey] = null;
		}
	} else {
		obj[firstKey] = parseInlineValue(firstValueStr);
	}

	// Detect continuation indent: next content line that is more indented than
	// the "- " line (standard is itemLine.indent + 2, but we detect dynamically).
	const next = ctx.contentLines[ctx.pos];
	if (next !== undefined && next.indent > itemLine.indent && !isSequenceItem(next.content)) {
		const continuationIndent = next.indent;
		const rest = parseMapping(ctx, continuationIndent);
		return { ...obj, ...rest };
	}

	return obj;
}

// ---------------------------------------------------------------------------
// Value dispatch
// ---------------------------------------------------------------------------

/**
 * Parse the value portion of a `key: <valueStr>` pair.
 * `currentLine` is the line that contained the key (needed for block-scalar
 * indent reference).
 */
function parseValue(ctx: ParseCtx, valueStr: string, currentLine: ContentLine): YamlValue {
	if (valueStr === '') {
		// No inline value — look ahead
		const next = ctx.contentLines[ctx.pos];
		if (next === undefined) return null;

		// De-indented relative to current: null value
		if (next.indent < currentLine.indent) return null;

		// Same-indent: only valid when it's a block sequence item
		// (compact YAML notation: "key:\n- item" where sequence is at same level)
		if (next.indent === currentLine.indent && !isSequenceItem(next.content)) return null;

		if (isSequenceItem(next.content)) {
			return parseSequence(ctx, next.indent);
		}
		return parseMapping(ctx, next.indent);
	}

	if (valueStr === '|' || valueStr === '|-' || valueStr === '|+') {
		return parseLiteralBlock(ctx, currentLine, chompingFromIndicator(valueStr));
	}
	if (valueStr === '>' || valueStr === '>-' || valueStr === '>+') {
		return parseFoldedBlock(ctx, currentLine, chompingFromIndicator(valueStr));
	}

	return parseInlineValue(valueStr);
}

// ---------------------------------------------------------------------------
// Block scalar parsers
// ---------------------------------------------------------------------------

type Chomping = 'clip' | 'strip' | 'keep';

function chompingFromIndicator(indicator: string): Chomping {
	if (indicator.endsWith('-')) return 'strip';
	if (indicator.endsWith('+')) return 'keep';
	return 'clip';
}

/**
 * Collect a literal block scalar (`|`).
 * Raw lines starting immediately after `indicatorLine.rawIdx` are collected
 * until we de-indent back to ≤ indicatorLine.indent.
 */
function parseLiteralBlock(ctx: ParseCtx, indicatorLine: ContentLine, chomping: Chomping): string {
	const result = collectBlockLines(
		ctx.rawLines,
		indicatorLine.rawIdx + 1,
		indicatorLine.indent,
		'literal',
	);

	// Advance contentLines pos past consumed raw lines
	while (ctx.pos < ctx.contentLines.length) {
		const cl = ctx.contentLines[ctx.pos];
		if (cl === undefined || cl.rawIdx >= result.endRawIdx) break;
		ctx.pos++;
	}

	return applyChomping(result.lines.join('\n'), chomping, result.trailingBlanks);
}

/**
 * Collect a folded block scalar (`>`).
 */
function parseFoldedBlock(ctx: ParseCtx, indicatorLine: ContentLine, chomping: Chomping): string {
	const result = collectBlockLines(
		ctx.rawLines,
		indicatorLine.rawIdx + 1,
		indicatorLine.indent,
		'folded',
	);

	while (ctx.pos < ctx.contentLines.length) {
		const cl = ctx.contentLines[ctx.pos];
		if (cl === undefined || cl.rawIdx >= result.endRawIdx) break;
		ctx.pos++;
	}

	return applyChomping(result.lines.join('\n'), chomping, result.trailingBlanks);
}

interface BlockResult {
	/** Collected lines with trailing blanks already stripped. */
	lines: string[];
	/** Number of trailing blank lines stripped (needed for `keep` chomping). */
	trailingBlanks: number;
	/** First rawIdx NOT consumed (i.e. the line after the block). */
	endRawIdx: number;
}

function collectBlockLines(
	rawLines: string[],
	startRawIdx: number,
	indicatorIndent: number,
	mode: 'literal' | 'folded',
): BlockResult {
	let blockIndent = -1;
	const collected: string[] = [];
	let i = startRawIdx;

	for (; i < rawLines.length; i++) {
		const raw = (rawLines[i] ?? '').replace(/\t/g, '  ');
		const trimmed = raw.trimStart();

		// Inside a block scalar, only truly empty lines are blank — `#` lines are
		// literal content (markdown headings, code comments, etc.) not YAML comments.
		if (trimmed === '') {
			// Blank line: include as empty string in block (only if we've started)
			if (blockIndent !== -1) collected.push('');
			continue;
		}

		const indent = raw.length - trimmed.length;

		if (blockIndent === -1) {
			// First content line determines the block's indent level
			if (indent <= indicatorIndent) break; // empty block
			blockIndent = indent;
		}

		if (indent < blockIndent) break; // de-indented: block ended

		// Content relative to blockIndent, preserving extra indentation
		collected.push(raw.slice(blockIndent));
	}

	// Strip trailing blank lines, preserving count for keep-chomping
	let trailingBlanks = 0;
	while (collected.length > 0 && collected[collected.length - 1] === '') {
		collected.pop();
		trailingBlanks++;
	}

	if (mode === 'folded') {
		// Fold: consecutive non-blank lines join with a space; blank lines become
		// paragraph separators (kept as empty strings in the array).
		const parts: string[] = [];
		let pendingBlank = false;
		for (const line of collected) {
			if (line === '') {
				pendingBlank = true;
			} else if (pendingBlank) {
				parts.push('');
				parts.push(line);
				pendingBlank = false;
			} else if (parts.length > 0) {
				const prev = parts[parts.length - 1];
				if (prev !== undefined && prev !== '') {
					parts[parts.length - 1] = `${prev} ${line}`;
				} else {
					parts.push(line);
				}
			} else {
				parts.push(line);
			}
		}
		return { lines: parts, trailingBlanks, endRawIdx: i };
	}

	return { lines: collected, trailingBlanks, endRawIdx: i };
}

function applyChomping(text: string, chomping: Chomping, trailingBlanks: number): string {
	if (chomping === 'strip') return text;
	if (chomping === 'keep') return text + '\n'.repeat(trailingBlanks + 1);
	// clip: exactly one trailing newline regardless of how many blank lines followed
	return `${text}\n`;
}

// ---------------------------------------------------------------------------
// Inline value parsers
// ---------------------------------------------------------------------------

function parseInlineValue(raw: string): YamlValue {
	const str = removeInlineComment(raw).trim();

	if (str === '') return null;

	// Inline sequence
	if (str.startsWith('[')) return parseInlineArray(str);

	// Double-quoted string
	if (str.startsWith('"') && str.endsWith('"') && str.length >= 2) {
		return unescapeDoubleQuoted(str.slice(1, -1));
	}

	// Single-quoted string
	if (str.startsWith("'") && str.endsWith("'") && str.length >= 2) {
		// Single-quoted: only '' escapes a literal single quote
		return str.slice(1, -1).replace(/''/g, "'");
	}

	// Booleans
	const lower = str.toLowerCase();
	if (lower === 'true' || lower === 'yes' || lower === 'on') return true;
	if (lower === 'false' || lower === 'no' || lower === 'off') return false;

	// Null
	if (lower === 'null' || lower === '~') return null;

	// Integer (decimal, hex, octal)
	if (/^-?[0-9]+$/.test(str)) {
		const n = Number(str);
		return Number.isFinite(n) ? n : str;
	}
	if (/^0x[0-9a-fA-F]+$/i.test(str)) return parseInt(str, 16);
	if (/^0o[0-7]+$/i.test(str)) return parseInt(str.slice(2), 8);

	// Float
	if (/^-?[0-9]*\.[0-9]+([eE][+-]?[0-9]+)?$/.test(str)) {
		const n = parseFloat(str);
		return Number.isFinite(n) ? n : str;
	}
	if (/^-?\.inf$/i.test(str)) return str.startsWith('-') ? -Infinity : Infinity;
	if (/^\.nan$/i.test(str)) return NaN;

	// Plain string
	return str;
}

function parseInlineArray(str: string): YamlValue[] {
	const inner = str.slice(1, -1).trim();
	if (inner === '') return [];

	const items: YamlValue[] = [];
	let depth = 0;
	let inSingle = false;
	let inDouble = false;
	let start = 0;

	for (let i = 0; i < inner.length; i++) {
		const ch = inner[i];

		if (ch === '"' && !inSingle) inDouble = !inDouble;
		else if (ch === "'" && !inDouble) inSingle = !inSingle;
		else if (!inSingle && !inDouble) {
			if (ch === '[' || ch === '{') depth++;
			else if (ch === ']' || ch === '}') depth--;
			else if (ch === ',' && depth === 0) {
				items.push(parseInlineValue(inner.slice(start, i).trim()));
				start = i + 1;
			}
		}
	}

	const last = inner.slice(start).trim();
	if (last !== '') items.push(parseInlineValue(last));

	return items;
}

// ---------------------------------------------------------------------------
// Scalar helpers
// ---------------------------------------------------------------------------

/**
 * Single-pass unescape of YAML double-quoted string escapes.
 * Must be single-pass to prevent `\\n` (backslash + n) from being
 * incorrectly converted into a newline by two successive replacements.
 */
function unescapeDoubleQuoted(s: string): string {
	return s.replace(/\\(u[0-9a-fA-F]{4}|U[0-9a-fA-F]{8}|.)/gs, (_, esc: string) => {
		if (esc.startsWith('u')) return String.fromCharCode(parseInt(esc.slice(1), 16));
		if (esc.startsWith('U')) return String.fromCodePoint(parseInt(esc.slice(1), 16));
		switch (esc) {
			case '\\':
				return '\\';
			case '"':
				return '"';
			case 'n':
				return '\n';
			case 'r':
				return '\r';
			case 't':
				return '\t';
			case '0':
				return '\0';
			case 'a':
				return '\x07';
			case 'b':
				return '\b';
			case 'f':
				return '\f';
			case 'v':
				return '\x0B';
			default:
				return esc; // unknown escape → keep the character
		}
	});
}

/**
 * Remove a trailing inline comment from a value string.
 * Handles quoted strings correctly (comment markers inside quotes are preserved).
 */
function removeInlineComment(str: string): string {
	let inSingle = false;
	let inDouble = false;

	for (let i = 0; i < str.length; i++) {
		const ch = str[i];
		if (ch === '"' && !inSingle) inDouble = !inDouble;
		else if (ch === "'" && !inDouble) inSingle = !inSingle;
		else if (!inSingle && !inDouble && ch === '#') {
			if (i === 0 || str[i - 1] === ' ' || str[i - 1] === '\t') {
				return str.slice(0, i).trimEnd();
			}
		}
	}

	return str;
}

/**
 * Find the index of the first `:` that is followed by a space, tab, or
 * end-of-string — and is not inside a quoted string.
 * Returns -1 if none is found.
 */
function findUnquotedColon(content: string): number {
	let inSingle = false;
	let inDouble = false;

	for (let i = 0; i < content.length; i++) {
		const ch = content[i];

		if (ch === '"' && !inSingle) inDouble = !inDouble;
		else if (ch === "'" && !inDouble) inSingle = !inSingle;
		else if (!inSingle && !inDouble && ch === ':') {
			const next = content[i + 1];
			if (next === undefined || next === ' ' || next === '\t') {
				return i;
			}
		}
	}

	return -1;
}

function isSequenceItem(content: string): boolean {
	return content === '-' || content.startsWith('- ');
}
