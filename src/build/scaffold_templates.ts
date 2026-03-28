// ---------------------------------------------------------------------------
// Static scaffold file contents
// ---------------------------------------------------------------------------

export const BASE_HTML = `<!doctype html>
<html lang="{{ site.language }}">
<head>
</head>
<body>
{{> "nav.html"}}
{{{ content }}}
{{> "footer.html"}}
</body>
</html>
`;

export const PAGE_HTML = `<!-- layout: base.html -->
<main>
  <article>
    <h1>{{ page.title }}</h1>
    {{{ content }}}
  </article>
</main>
`;

export const POST_HTML = `<!-- layout: base.html -->
<main>
  <article>
    {{> "breadcrumb.html"}}
    <header>
      <h1>{{ page.title }}</h1>
      {{#if page.datePublished}}
      <time datetime="{{ page.datePublished }}">{{ page.datePublished }}</time>
      {{/if}}
      {{#if page.author}}
      <span class="author">{{ page.author }}</span>
      {{/if}}
    </header>
    {{{ content }}}
  </article>
</main>
`;

export const NAV_HTML = `<nav>
  {{#each data.nav as item}}
  <a href="{{ item.href }}">{{ item.label }}</a>
  {{/each}}
</nav>
`;

export const FOOTER_HTML = `<footer>
  <p>&copy; {{ build.year }} {{ site.name }}</p>
  {{> "nav.html"}}
</footer>
`;

export const STYLE_CSS = `/* Reset */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

/* Variables */
:root {
  --color-bg: #ffffff;
  --color-text: #1a1a1a;
  --color-link: #0066cc;
  --color-link-hover: #004499;
  --font-body: system-ui, -apple-system, sans-serif;
  --font-mono: ui-monospace, monospace;
  --width-content: 70ch;
  --space: 1rem;
}

/* Base */
html { font-family: var(--font-body); font-size: 100%; line-height: 1.6; color: var(--color-text); background: var(--color-bg); }
body { max-width: var(--width-content); margin: 0 auto; padding: var(--space); }

/* Typography */
h1, h2, h3, h4, h5, h6 { line-height: 1.2; margin-block: 1.5em 0.5em; }
p { margin-block-end: 1em; }
a { color: var(--color-link); }
a:hover { color: var(--color-link-hover); }
code, pre { font-family: var(--font-mono); font-size: 0.9em; }
pre { overflow-x: auto; padding: 1em; background: #f5f5f5; border-radius: 4px; }
img { max-width: 100%; height: auto; display: block; }

/* Nav */
nav { margin-block-end: 2rem; }
nav a { margin-inline-end: 1rem; }

/* Footer */
footer { margin-block-start: 4rem; padding-block-start: 1rem; border-top: 1px solid #e0e0e0; font-size: 0.875rem; }
`;

export const ROBOTS_TXT = `User-agent: *
Allow: /

# AI crawlers — explicitly allowed
User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: PerplexityBot
Allow: /

Sitemap: {SITE_URL}/sitemap.xml
`;

export const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" fill="#0066cc" rx="4"/>
  <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" fill="#fff" font-size="18" font-family="system-ui">G</text>
</svg>
`;

export const NAV_JSON = JSON.stringify(
	[
		{ label: 'Home', href: '/' },
		{ label: 'About', href: '/about/' },
	],
	null,
	'\t',
);

export const INDEX_MD = `---
title: Welcome to {SITE_NAME}
description: The homepage of {SITE_NAME}.
layout: page.html
---

This is the homepage. Edit \`content/index.md\` to get started.
`;

export const ABOUT_MD = `---
title: About
description: Learn more about {SITE_NAME}.
layout: page.html
---

Tell visitors about yourself and your site.
`;

/**
 * Blog collection listing template.
 * Rendered for the collection index page (e.g. `/blog/`).
 * Uses `collections.blog` array from template context — each item has:
 *   url, title, description, datePublished, author.
 */
export const BLOG_HTML = `<!-- layout: base.html -->
<main>
  <article>
    <h1>{{ page.title }}</h1>
    {{{ content }}}
    {{#if collections.blog}}
    <ul class="post-list">
      {{#each collections.blog as post}}
      <li class="post-item">
        <a class="post-title" href="{{ post.url }}">{{ post.title }}</a>
        <div>
          {{#if post.datePublished}}<time datetime="{{ post.datePublished }}">{{ post.datePublished }}</time>{{/if}}
          {{#if post.author}}<span class="post-author">{{ post.author }}</span>{{/if}}
        </div>
        {{#if post.description}}<p class="post-desc">{{ post.description }}</p>{{/if}}
      </li>
      {{/each}}
    </ul>
    {{/if}}
  </article>
</main>
`;

// ---------------------------------------------------------------------------
// Building-block templates (Schema.org baked in)
// ---------------------------------------------------------------------------

/**
 * FAQ template — renders page.faqs frontmatter array as an accessible
 * disclosure widget.  FAQPage JSON-LD is auto-injected by the build pipeline
 * when the faqs: key is present in frontmatter.
 *
 * Frontmatter shape:
 *   template: faq
 *   faqs:
 *     - q: "What is …?"
 *       a: "It is …"
 */
export const FAQ_HTML = `<!-- layout: base.html -->
<main>
  <article>
    <h1>{{ page.title }}</h1>
    {{{ content }}}
    {{#if page.faqs}}
    <section class="faq-list" aria-label="Frequently asked questions">
      {{#each page.faqs as faq}}
      <details class="faq-item">
        <summary class="faq-question">{{ faq.q }}</summary>
        <div class="faq-answer">{{ faq.a }}</div>
      </details>
      {{/each}}
    </section>
    {{/if}}
  </article>
</main>
`;

/**
 * Breadcrumb partial — include via {{> "breadcrumb.html"}} in page.html or
 * base.html.  BreadcrumbList JSON-LD is auto-injected by the build pipeline
 * when the breadcrumb: key is present in frontmatter.
 *
 * Frontmatter shape:
 *   breadcrumb:
 *     - label: Home
 *       href: /
 *     - label: Blog
 *       href: /blog/
 *     - label: My Post
 *       href: /blog/my-post/
 */
export const BREADCRUMB_HTML = `{{#if page.breadcrumb}}
<nav class="breadcrumb" aria-label="Breadcrumb">
  <ol>
    {{#each page.breadcrumb as crumb}}
    <li><a href="{{ crumb.href }}">{{ crumb.label }}</a></li>
    {{/each}}
  </ol>
</nav>
{{/if}}
`;

/**
 * Table template — renders page.tableHeaders + page.tableRows frontmatter
 * as a semantic, accessible HTML table.
 *
 * Frontmatter shape:
 *   template: table
 *   tableCaption: "Pricing comparison"
 *   tableHeaders: [Plan, Price, Seats]
 *   tableRows:
 *     - [Starter, Free, 1]
 *     - [Pro, "$12/mo", 5]
 *     - [Team, "$49/mo", 25]
 */
export const TABLE_HTML = `<!-- layout: base.html -->
<main>
  <article>
    <h1>{{ page.title }}</h1>
    {{{ content }}}
    {{#if page.tableHeaders}}
    <div class="table-wrapper">
      <table>
        {{#if page.tableCaption}}
        <caption>{{ page.tableCaption }}</caption>
        {{/if}}
        <thead>
          <tr>
            {{#each page.tableHeaders as header}}
            <th scope="col">{{ header }}</th>
            {{/each}}
          </tr>
        </thead>
        <tbody>
          {{#each page.tableRows as row}}
          <tr>
            {{#each row as cell}}
            <td>{{ cell }}</td>
            {{/each}}
          </tr>
          {{/each}}
        </tbody>
      </table>
    </div>
    {{/if}}
  </article>
</main>
`;
