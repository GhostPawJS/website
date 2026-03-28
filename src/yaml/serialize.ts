// ---------------------------------------------------------------------------
// Minimal YAML frontmatter serializer.
//
// Handles exactly the subset used in page frontmatter:
//   scalars: string, number, boolean, null
//   arrays:  block sequence of scalars, plain objects (e.g. faqs), or nested arrays (e.g. tableRows)
//   objects: block mapping (one level of nesting only)
//
// Produces output that round-trips cleanly through the project's YAML parser.
// ---------------------------------------------------------------------------

/** Characters that force a string to be double-quoted. */
const NEEDS_QUOTE_RE = /[:#[\]{},|>&*!'"@`%]|^\s|\s$|^(true|false|null|~|yes|no|on|off)$/i;

/**
 * Serialize a string scalar for YAML.
 * Strings containing special chars or that look like booleans/null are quoted.
 */
function serializeString(s: string): string {
	if (s === '') return '""';
	if (NEEDS_QUOTE_RE.test(s) || /\n/.test(s)) {
		// Double-quoted with escape sequences for special chars
		return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r')}"`;
	}
	return s;
}

/** Serialize a scalar value (string, number, boolean, null). */
function serializeScalar(v: unknown): string {
	if (v === null || v === undefined) return 'null';
	if (typeof v === 'boolean') return v ? 'true' : 'false';
	if (typeof v === 'number') return String(v);
	return serializeString(String(v));
}

/** Serialize an array as a YAML block sequence (items may be scalars, plain objects, or arrays). */
function serializeArray(arr: unknown[], indent: string): string {
	if (arr.length === 0) return '[]';
	return arr
		.map((item) => {
			if (Array.isArray(item)) {
				// Nested array: use block form with empty outer "-" then indented inner items
				if (item.length === 0) return `${indent}- []`;
				return `${indent}-\n${serializeArray(item, `${indent}  `)}`;
			}
			if (item !== null && typeof item === 'object' && !Buffer.isBuffer(item)) {
				const entries = Object.entries(item as Record<string, unknown>);
				if (entries.length === 0) return `${indent}- {}`;
				const [firstEntry, ...rest] = entries as [[string, unknown], ...[string, unknown][]];
				const firstLine = `${indent}- ${serializeString(firstEntry[0])}: ${serializeScalar(firstEntry[1])}`;
				const restLines = rest.map(
					([k, v]) => `${indent}  ${serializeString(k)}: ${serializeScalar(v)}`,
				);
				return [firstLine, ...restLines].join('\n');
			}
			return `${indent}- ${serializeScalar(item)}`;
		})
		.join('\n');
}

/** Serialize a nested plain object as a YAML block mapping. */
function serializeObject(obj: Record<string, unknown>, indent: string): string {
	const lines: string[] = [];
	for (const [k, v] of Object.entries(obj)) {
		lines.push(`${indent}${serializeString(k)}: ${serializeScalar(v)}`);
	}
	return lines.join('\n');
}

/**
 * Serialize a frontmatter object to a YAML block mapping string (no `---` delimiters).
 *
 * Values supported:
 * - `string | number | boolean | null` → scalar
 * - `unknown[]` → block sequence of scalars or plain objects (e.g. faqs, breadcrumb items)
 * - `Record<string, unknown>` with scalar values → nested block mapping
 *
 * Non-serializable values (functions, deeply nested arrays, etc.) are silently skipped.
 */
export function serializeFrontmatter(data: Record<string, unknown>): string {
	const lines: string[] = [];
	for (const [key, value] of Object.entries(data)) {
		if (value === undefined) continue;
		const k = serializeString(key);
		if (Array.isArray(value)) {
			if (value.length === 0) {
				lines.push(`${k}: []`);
			} else {
				lines.push(`${k}:`);
				lines.push(serializeArray(value, '  '));
			}
		} else if (value !== null && typeof value === 'object' && !Buffer.isBuffer(value)) {
			const nested = serializeObject(value as Record<string, unknown>, '  ');
			if (nested) {
				lines.push(`${k}:`);
				lines.push(nested);
			} else {
				lines.push(`${k}: {}`);
			}
		} else {
			lines.push(`${k}: ${serializeScalar(value)}`);
		}
	}
	return lines.join('\n');
}
