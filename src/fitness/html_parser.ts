// ---------------------------------------------------------------------------
// Regex-based HTML extraction utilities.
// Designed for clean, predictable HTML produced by the build pipeline.
// All functions are pure and synchronous — no DOM, no external deps.
// ---------------------------------------------------------------------------

/** Extract the content of the first `<title>` element. */
export function getTitle(html: string): string {
	const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
	return m ? decodeEntities(m[1] ?? '') : '';
}

/**
 * Extract a `<meta name="..." content="...">` value (case-insensitive name match).
 * Returns '' when not found.
 */
export function getMetaName(html: string, name: string): string {
	// Match both attribute orders
	const re = new RegExp(
		`<meta[^>]+name\\s*=\\s*["']${escapeRegex(name)}["'][^>]+content\\s*=\\s*["']([^"']*)["']` +
			`|<meta[^>]+content\\s*=\\s*["']([^"']*)["'][^>]+name\\s*=\\s*["']${escapeRegex(name)}["']`,
		'i',
	);
	const m = html.match(re);
	if (!m) return '';
	return decodeEntities(m[1] ?? m[2] ?? '');
}

/**
 * Extract a `<meta property="..." content="...">` value (Open Graph etc.).
 * Returns '' when not found.
 */
export function getMetaProperty(html: string, property: string): string {
	const re = new RegExp(
		`<meta[^>]+property\\s*=\\s*["']${escapeRegex(property)}["'][^>]+content\\s*=\\s*["']([^"']*)["']` +
			`|<meta[^>]+content\\s*=\\s*["']([^"']*)["'][^>]+property\\s*=\\s*["']${escapeRegex(property)}["']`,
		'i',
	);
	const m = html.match(re);
	if (!m) return '';
	return decodeEntities(m[1] ?? m[2] ?? '');
}

/** Extract `<link rel="canonical" href="...">`. Returns '' when absent. */
export function getCanonical(html: string): string {
	const re =
		/<link[^>]+rel\s*=\s*["']canonical["'][^>]+href\s*=\s*["']([^"']*)["']|<link[^>]+href\s*=\s*["']([^"']*)["'][^>]+rel\s*=\s*["']canonical["']/i;
	const m = html.match(re);
	if (!m) return '';
	return m[1] ?? m[2] ?? '';
}

/** Extract value of `<html lang="...">`. */
export function getHtmlLang(html: string): string {
	const m = html.match(/<html[^>]+lang\s*=\s*["']([^"']*)["']/i);
	return m ? (m[1] ?? '') : '';
}

export interface LinkInfo {
	href: string;
	text: string;
	rel: string;
	target: string;
}

/** Extract all `<a href>` links from HTML. */
export function getLinks(html: string): LinkInfo[] {
	const links: LinkInfo[] = [];
	// Match opening <a> tag + content + closing </a>
	const tagRe = /<a\s([^>]*)>([\s\S]*?)<\/a>/gi;
	for (;;) {
		const m = tagRe.exec(html);
		if (!m) break;
		const attrs = m[1] ?? '';
		const content = m[2] ?? '';
		const href = attrVal(attrs, 'href');
		if (!href) continue;
		links.push({
			href,
			text: stripTags(content).replace(/\s+/g, ' ').trim(),
			rel: attrVal(attrs, 'rel'),
			target: attrVal(attrs, 'target'),
		});
	}
	return links;
}

export interface ImageInfo {
	src: string;
	alt: string;
	width: string;
	height: string;
	loading: string;
	srcset: string;
}

/** Extract all `<img>` tags from HTML. */
export function getImages(html: string): ImageInfo[] {
	const imgs: ImageInfo[] = [];
	const re = /<img\s([^>]*?)(?:\s*\/?)?>/gi;
	for (;;) {
		const m = re.exec(html);
		if (!m) break;
		const attrs = m[1] ?? '';
		const src = attrVal(attrs, 'src');
		if (!src) continue;
		imgs.push({
			src,
			alt: attrVal(attrs, 'alt'),
			width: attrVal(attrs, 'width'),
			height: attrVal(attrs, 'height'),
			loading: attrVal(attrs, 'loading'),
			srcset: attrVal(attrs, 'srcset'),
		});
	}
	return imgs;
}

export interface HeadingInfo {
	level: 1 | 2 | 3 | 4 | 5 | 6;
	text: string;
}

/** Extract all heading elements (h1-h6) in document order. */
export function getHeadings(html: string): HeadingInfo[] {
	const headings: HeadingInfo[] = [];
	const re = /<h([1-6])\s*[^>]*>([\s\S]*?)<\/h\1>/gi;
	for (;;) {
		const m = re.exec(html);
		if (!m) break;
		const level = parseInt(m[1] ?? '1', 10) as 1 | 2 | 3 | 4 | 5 | 6;
		const text = stripTags(m[2] ?? '')
			.replace(/\s+/g, ' ')
			.trim();
		headings.push({ level, text });
	}
	return headings;
}

/** Extract parsed JSON-LD objects from `<script type="application/ld+json">` blocks. */
export function getJsonLd(html: string): unknown[] {
	const results: unknown[] = [];
	const re = /<script[^>]+type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
	for (;;) {
		const m = re.exec(html);
		if (!m) break;
		try {
			results.push(JSON.parse(m[1] ?? ''));
		} catch {
			// malformed — skip
		}
	}
	return results;
}

/** Extract all element `id` attribute values. */
export function getElementIds(html: string): string[] {
	const ids: string[] = [];
	const re = /\sid\s*=\s*["']([^"']+)["']/gi;
	for (;;) {
		const m = re.exec(html);
		if (!m) break;
		if (m[1]) ids.push(m[1]);
	}
	return ids;
}

/** Return true when the document starts with an HTML5 doctype. */
export function hasDoctype(html: string): boolean {
	return /^\s*<!doctype\s+html\s*>/i.test(html);
}

/**
 * Return true when the `<body>` contains inline `<style>` tags.
 * (Not counting styles in the `<head>` which are acceptable.)
 */
export function hasBodyInlineStyles(html: string): boolean {
	const body = extractBody(html);
	return /<style[\s>]/i.test(body);
}

/**
 * Return true when the `<body>` contains inline `<script>` tags that are NOT
 * JSON-LD (those are generated by the build pipeline and are acceptable).
 */
export function hasBodyInlineScripts(html: string): boolean {
	const body = extractBody(html);
	// JSON-LD scripts are allowed; bare <script> tags are not
	return /<script(?!\s[^>]*type\s*=\s*["']application\/ld\+json["'])[^>]*>/i.test(body);
}

/** Extract all `src` / `href` asset references (CSS, JS, images) from HTML. */
export function getAssetRefs(html: string): string[] {
	const refs: string[] = [];
	const patterns = [
		/<link[^>]+href\s*=\s*["']([^"'#?]+\.(?:css|woff2?|ttf|otf|eot))["']/gi,
		/<script[^>]+src\s*=\s*["']([^"'#?]+\.js)["']/gi,
		/<img[^>]+src\s*=\s*["']([^"'#?]+)["']/gi,
	];
	for (const re of patterns) {
		for (;;) {
			const m = re.exec(html);
			if (!m) break;
			if (m[1]) refs.push(m[1]);
		}
	}
	return refs;
}

/** Return all `id` values that appear more than once. */
export function getDuplicateIds(html: string): string[] {
	const ids = getElementIds(html);
	const seen = new Map<string, number>();
	for (const id of ids) seen.set(id, (seen.get(id) ?? 0) + 1);
	return [...seen.entries()].filter(([, count]) => count > 1).map(([id]) => id);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Extract an attribute value from an attribute string. Handles single/double quotes and unquoted. */
function attrVal(attrs: string, name: string): string {
	const re = new RegExp(
		`(?:^|\\s)${escapeRegex(name)}\\s*=\\s*(?:"([^"]*?)"|'([^']*?)'|([^\\s>]*))`,
		'i',
	);
	const m = attrs.match(re);
	if (!m) return '';
	return m[1] ?? m[2] ?? m[3] ?? '';
}

/** Strip HTML tags, preserving inner text. */
export function stripTags(html: string): string {
	return html
		.replace(/<[^>]+>/g, ' ')
		.replace(/\s{2,}/g, ' ')
		.trim();
}

/** Decode basic HTML entities. */
function decodeEntities(s: string): string {
	return s
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&nbsp;/g, ' ');
}

function escapeRegex(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Extract the content between `<body>` and `</body>` (or the whole string if absent). */
function extractBody(html: string): string {
	const m = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
	return m ? (m[1] ?? '') : html;
}
