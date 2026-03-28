import { absoluteUrl } from '../content/url_routing.ts';
import { htmlEscape } from '../template/render.ts';
import type { ContentPage, SiteConfig } from '../types.ts';

/**
 * Build the `<head>` injection block for a rendered page.
 * Returns an HTML string of `<meta>`, `<link>`, and `<script>` tags.
 */
export function buildHeadInjection(page: ContentPage, config: SiteConfig): string {
	const fm = page.frontmatter;
	const canonical = absoluteUrl(config.url, page.url);
	const title = fm.title ? htmlEscape(String(fm.title)) : htmlEscape(config.name);
	const description = fm.description ? htmlEscape(String(fm.description)) : '';
	const ogImage =
		(fm.og_image ?? fm.image) ? absoluteUrl(config.url, String(fm.og_image ?? fm.image)) : '';
	const lang = htmlEscape(config.language);

	const isPost = fm.layout === 'post.html';

	const lines: string[] = [];

	// Charset + viewport (always)
	lines.push('<meta charset="UTF-8">');
	lines.push('<meta name="viewport" content="width=device-width, initial-scale=1">');

	// lang on html element is done at template level; we supply it as a meta fallback context var

	// Title
	lines.push(`<title>${title}</title>`);

	// Description
	if (description) {
		lines.push(`<meta name="description" content="${description}">`);
	}

	// Canonical
	lines.push(`<link rel="canonical" href="${htmlEscape(canonical)}">`);

	// Robots
	const robotsDirectives: string[] = [];
	if (fm.noindex) robotsDirectives.push('noindex');
	if (fm.nofollow) robotsDirectives.push('nofollow');
	if (robotsDirectives.length > 0) {
		lines.push(`<meta name="robots" content="${robotsDirectives.join(', ')}">`);
	}

	// Open Graph
	lines.push(`<meta property="og:type" content="${isPost ? 'article' : 'website'}">`);
	lines.push(`<meta property="og:title" content="${title}">`);
	lines.push(`<meta property="og:url" content="${htmlEscape(canonical)}">`);
	if (description) {
		lines.push(`<meta property="og:description" content="${description}">`);
	}
	if (ogImage) {
		lines.push(`<meta property="og:image" content="${htmlEscape(ogImage)}">`);
	}
	if (isPost && fm.datePublished) {
		lines.push(
			`<meta property="article:published_time" content="${htmlEscape(String(fm.datePublished))}">`,
		);
	}
	if (isPost && fm.author) {
		lines.push(`<meta property="article:author" content="${htmlEscape(String(fm.author))}">`);
	}

	// Twitter card
	lines.push(`<meta name="twitter:card" content="${ogImage ? 'summary_large_image' : 'summary'}">`);
	lines.push(`<meta name="twitter:title" content="${title}">`);
	if (description) {
		lines.push(`<meta name="twitter:description" content="${description}">`);
	}
	if (ogImage) {
		lines.push(`<meta name="twitter:image" content="${htmlEscape(ogImage)}">`);
	}

	// JSON-LD for BlogPosting — injected automatically for post.html layout
	if (isPost) {
		const ld: Record<string, unknown> = {
			'@context': 'https://schema.org',
			'@type': 'BlogPosting',
			headline: fm.title ? String(fm.title) : config.name,
			url: canonical,
		};
		if (fm.description) ld.description = String(fm.description);
		if (fm.datePublished) ld.datePublished = String(fm.datePublished);
		ld.author = { '@type': 'Person', name: fm.author ? String(fm.author) : (config.author ?? '') };
		if (ogImage) ld.image = ogImage;
		lines.push(`<script type="application/ld+json">\n${JSON.stringify(ld, null, 2)}\n</script>`);
	}

	// JSON-LD for Article/BlogPosting
	const schemaType = fm.schema_type ? String(fm.schema_type) : null;
	if (schemaType === 'Article' || schemaType === 'BlogPosting') {
		const ld: Record<string, unknown> = {
			'@context': 'https://schema.org',
			'@type': schemaType,
			headline: fm.title ?? '',
			url: canonical,
			datePublished: fm.date ?? '',
			dateModified: fm.dateModified ?? fm.date ?? '',
			author: {
				'@type': 'Person',
				name: fm.author ?? config.author ?? '',
			},
			publisher: {
				'@type': 'Organization',
				name: config.name,
			},
		};
		if (ogImage) ld.image = ogImage;
		lines.push(`<script type="application/ld+json">\n${JSON.stringify(ld, null, 2)}\n</script>`);
	}

	// JSON-LD for FAQPage — injected when page.faqs array is present in frontmatter
	if (Array.isArray(fm.faqs) && fm.faqs.length > 0) {
		const faqs = fm.faqs as Array<Record<string, unknown>>;
		const ld = {
			'@context': 'https://schema.org',
			'@type': 'FAQPage',
			mainEntity: faqs.map((faq) => ({
				'@type': 'Question',
				name: String(faq.q ?? faq.question ?? ''),
				acceptedAnswer: {
					'@type': 'Answer',
					text: String(faq.a ?? faq.answer ?? ''),
				},
			})),
		};
		lines.push(`<script type="application/ld+json">\n${JSON.stringify(ld, null, 2)}\n</script>`);
	}

	// JSON-LD for BreadcrumbList — injected when page.breadcrumb array is present in frontmatter
	if (Array.isArray(fm.breadcrumb) && fm.breadcrumb.length > 0) {
		const crumbs = fm.breadcrumb as Array<Record<string, unknown>>;
		const ld = {
			'@context': 'https://schema.org',
			'@type': 'BreadcrumbList',
			itemListElement: crumbs.map((crumb, i) => ({
				'@type': 'ListItem',
				position: i + 1,
				name: String(crumb.label ?? crumb.name ?? ''),
				...(crumb.href ? { item: absoluteUrl(config.url, String(crumb.href)) } : {}),
			})),
		};
		lines.push(`<script type="application/ld+json">\n${JSON.stringify(ld, null, 2)}\n</script>`);
	}

	// JSON-LD for WebSite + Organization on homepage
	if (page.url === '/') {
		const ldSite = {
			'@context': 'https://schema.org',
			'@type': 'WebSite',
			name: config.name,
			url: absoluteUrl(config.url, '/'),
		};
		lines.push(
			`<script type="application/ld+json">\n${JSON.stringify(ldSite, null, 2)}\n</script>`,
		);
		const ldOrg = {
			'@context': 'https://schema.org',
			'@type': 'Organization',
			name: config.name,
			url: absoluteUrl(config.url, '/'),
		};
		lines.push(`<script type="application/ld+json">\n${JSON.stringify(ldOrg, null, 2)}\n</script>`);
	}

	// Unused lang variable acknowledged (used by template via {{ site.language }})
	void lang;

	return lines.join('\n');
}

/**
 * Inject `headHtml` into a rendered HTML document's `<head>`.
 * Inserts immediately before `</head>`. If no `</head>` is present,
 * returns document unchanged.
 */
export function injectHead(document: string, headHtml: string): string {
	const insertAt = document.indexOf('</head>');
	if (insertAt === -1) return document;
	return `${document.slice(0, insertAt) + headHtml}\n${document.slice(insertAt)}`;
}
