import { marked } from 'marked';

// Configure marked once for the whole process.
// gfm = GitHub-flavoured Markdown, breaks = false (default paragraph behaviour)
marked.setOptions({ gfm: true });

/**
 * Convert a Markdown string to HTML. Synchronous wrapper around `marked.parse`.
 * Returns an HTML string.
 */
export function renderMarkdown(markdown: string): string {
	// marked.parse returns string | Promise<string> depending on async option;
	// with default options it returns string.
	const result = marked.parse(markdown) as string;
	return result;
}

/**
 * Strip HTML tags from a string, returning plain text.
 * Used for word-count and readability analysis.
 */
export function stripHtml(html: string): string {
	return html
		.replace(/<script[\s\S]*?<\/script>/gi, ' ')
		.replace(/<style[\s\S]*?<\/style>/gi, ' ')
		.replace(/<[^>]+>/g, ' ')
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/\s{2,}/g, ' ')
		.trim();
}

/**
 * Count words in a plain-text string.
 */
export function countWords(text: string): number {
	const trimmed = text.trim();
	if (trimmed === '') return 0;
	return trimmed.split(/\s+/).length;
}
