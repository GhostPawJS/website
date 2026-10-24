import { markdownToHtml } from './markdown/renderer.ts';

/** Convert Markdown to HTML synchronously. */
export function renderMarkdown(markdown: string): string {
	return markdownToHtml(markdown);
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
