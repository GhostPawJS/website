import type { Skill } from './types.ts';

export const templateComposition: Skill = {
	name: 'template-composition',
	description: 'How to use building-block templates and data files to avoid duplication.',
	whenToUse:
		'When creating or editing templates, setting up navigation, or refactoring repeated HTML.',
	content: `# Template Composition

## Template hierarchy

Templates live in \`templates/\`. The standard hierarchy:

\`\`\`
base.html     ← root layout: <html>, <head>, <body>, nav, footer
  page.html   ← standard content page (extends base via {{{ content }}})
  post.html   ← blog post (extends base, adds author/date/breadcrumb)
  faq.html    ← FAQ section (emits FAQPage JSON-LD automatically)
\`\`\`

A child template declares its parent with a comment on the first line:
\`\`\`html
<!-- layout: base.html -->
<main>{{{ content }}}</main>
\`\`\`

The child's rendered output replaces \`{{{ content }}}\` in the parent (triple braces = unescaped HTML).

## Template variable syntax

\`\`\`html
{{ page.title }}             ← escaped scalar (use for text values)
{{{ content }}}              ← unescaped HTML (use for rendered content blocks)
{{#if page.date}}            ← conditional block
  <time>{{ page.date }}</time>
{{/if}}
{{#each data.nav as item}}   ← loop over array
  <a href="{{ item.href }}">{{ item.label }}</a>
{{/each}}
{{> "breadcrumb.html"}}      ← include a partial template by filename
\`\`\`

## Template context variables

| Variable | Contents |
|---|---|
| \`page.*\` | Frontmatter fields + \`page.url\`, \`page.title\`, etc. |
| \`site.*\` | \`site.name\`, \`site.url\`, \`site.language\` |
| \`data.*\` | JSON data files — \`data/nav.json\` → \`data.nav\` |
| \`collections.*\` | \`collections.blog\` = array of blog post summaries |
| \`build.year\` | Current year (for copyright footers) |

## Data files

Shared structured data lives in \`data/\` as JSON. Reference in templates via \`data.<filename>\`:

\`\`\`
data/nav.json    →  data.nav
data/team.json   →  data.team
\`\`\`

The scaffold creates \`data/nav.json\` as a flat array:
\`\`\`json
[
  { "label": "Home",  "href": "/" },
  { "label": "Blog",  "href": "/blog/" },
  { "label": "About", "href": "/about/" }
]
\`\`\`

In \`base.html\`:
\`\`\`html
<nav>
  {{#each data.nav as item}}
    <a href="{{ item.href }}">{{ item.label }}</a>
  {{/each}}
</nav>
\`\`\`

## Building-block templates

These templates encapsulate correct Schema.org markup — use them instead of writing raw HTML:

**faq.html** — FAQPage schema with accessible disclosure widget:
\`\`\`yaml
# In page frontmatter:
layout: faq.html
faqs:
  - q: "What is the return policy?"
    a: "30 days, no questions asked."
\`\`\`
FAQPage JSON-LD is auto-injected when \`faqs:\` is present — no template changes needed.

**breadcrumb.html** — BreadcrumbList schema, used as a partial:
\`\`\`yaml
# In page frontmatter:
breadcrumb:
  - label: Home
    href: /
  - label: Blog
    href: /blog/
  - label: My Post
    href: /blog/my-post/
\`\`\`
Include in a template with \`{{> "breadcrumb.html"}}\`. BreadcrumbList JSON-LD is auto-injected.

**table.html** — Accessible data table from frontmatter:
\`\`\`yaml
# In page frontmatter:
layout: table.html
tableCaption: "Pricing comparison"
tableHeaders: [Plan, Price, Seats]
tableRows:
  - [Starter, Free, 1]
  - [Pro, "$12/mo", 5]
\`\`\`

## Avoid duplication checklist

- Navigation defined once in \`data/nav.json\`, rendered in \`base.html\` via \`{{#each data.nav as item}}\`.
- Footer defined once as a template partial \`footer.html\`, included via \`{{> "footer.html"}}\`.
- Repeated page sections → extract to a partial and include with \`{{> "partial.html"}}\`.
- Structured markup (FAQ, breadcrumb, table) → use the building-block template.
- Page-specific layout set in the page's \`layout:\` frontmatter field.
`,
};
