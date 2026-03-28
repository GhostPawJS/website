# Templates

## What it is

A template is an HTML file that defines how a page renders. Templates live under `templates/`. They use a Handlebars-like syntax for variable substitution and iteration.

Two template roles exist: **layouts** (top-level shells that receive `{{{ content }}}`) and **partials** (reusable fragments included via `{{> "partial.html"}}`). Some templates serve as both — they define a content region _and_ are themselves included by a base layout.

## Why it exists

Separating structure (HTML) from content (Markdown + frontmatter) means pages can be edited without touching templates, and templates can be redesigned without touching content. The auto-injection system means Schema.org JSON-LD is always present without being authored manually in every template.

---

## Syntax

### Variables

```handlebars
{{ page.title }}          -- HTML-escaped output
{{{ content }}}           -- Raw HTML output (use for rendered Markdown)
{{ site.name }}           -- Site config value
{{ data.nav }}            -- Data file value
```

`{{ }}` double-braces HTML-escape the output. `{{{ }}}` triple-braces output raw HTML. Use `{{{ content }}}` for the rendered Markdown body.

### Conditionals

```handlebars
{{#if page.author}}
  <span>{{ page.author }}</span>
{{/if}}
```

### Iteration

```handlebars
{{#each collections.blog as post}}
  <a href="{{ post.url }}">{{ post.title }}</a>
{{/each}}

{{#each data.nav as item}}
  <a href="{{ item.href }}">{{ item.label }}</a>
{{/each}}
```

### Partials

```handlebars
{{> "nav.html"}}
{{> "footer.html"}}
{{> "breadcrumb.html"}}
```

---

## Layout chain

A page opts into a layout by placing a `<!-- layout: {name} -->` comment at the top of its template:

```html
<!-- layout: base.html -->
<main>
  <article>
    <h1>{{ page.title }}</h1>
    {{{ content }}}
  </article>
</main>
```

When the builder renders this page, it:
1. Renders the page template into HTML
2. Sets `content` to the result
3. Renders `base.html` with `{{{ content }}}` replaced

Layouts can chain: a template can declare `<!-- layout: base.html -->` and be a layout for other templates. The chain resolves until a template with no layout declaration is reached.

---

## Template context

Every template receives the following context object:

| Variable | Type | Notes |
|----------|------|-------|
| `page` | `PageFrontmatter & { url, slug, content }` | Current page frontmatter + metadata |
| `site` | `SiteConfig` | From `site.json` |
| `data` | `Record<string, unknown>` | All parsed data files by bare name |
| `collections` | `Record<string, CollectionItem[]>` | All collections, sorted newest-first |
| `build` | `{ year: number, timestamp: string }` | Build-time metadata |
| `content` | `string` | Rendered Markdown as HTML (in layout templates) |

Frontmatter fields are accessed as `page.{field}`:

```handlebars
{{ page.title }}
{{ page.description }}
{{ page.datePublished }}
{{ page.author }}
```

---

## Scaffolded templates

`scaffold()` writes these templates on first setup. They are designed to be immediately functional and are intended as starting points to customise.

### Base templates

| Template | Role |
|----------|------|
| `base.html` | Top-level shell. Contains `<html>`, `<head>`, `<body>`. All other templates nest inside it. |
| `page.html` | Standard page layout. Renders `<main>` with title and content. |
| `post.html` | Blog/article layout. Renders breadcrumb, `<header>` with date and author, and content. |
| `blog.html` | Collection listing layout. Renders the `collections.blog` array as a post list. |
| `nav.html` | Navigation partial. Iterates `data.nav` to render anchor links. |
| `footer.html` | Footer partial. Renders copyright year from `build.year`. |

### Building-block templates

These templates are purpose-built for specific content types and carry built-in Schema.org support.

| Template | Frontmatter fields consumed | Schema.org injected |
|----------|-----------------------------|---------------------|
| `faq.html` | `faqs: [{q, a}]` | `FAQPage` + `Question` + `Answer` |
| `breadcrumb.html` | `breadcrumb: [{label, href}]` | `BreadcrumbList` |
| `table.html` | `tableCaption`, `tableHeaders`, `tableRows` | — |

The building-block templates are designed to be composed, not used alone. Include them in `page.html` or `post.html` as partials, or use them directly as the `layout` for dedicated pages.

---

## Auto-injected head content

The build pipeline injects the following into every page's `<head>` automatically — before `</head>` — regardless of which template is used:

- `<meta charset="UTF-8">` and `<meta name="viewport">`
- `<title>` from `page.title`
- `<meta name="description">` when `description` is set
- `<link rel="canonical">` (auto-generated from site URL and page URL)
- `<meta name="robots">` when `noindex` or `nofollow` is set
- Open Graph tags: `og:type`, `og:title`, `og:url`, `og:description`, `og:image`
- `article:published_time` and `article:author` for `post.html` pages
- Twitter card tags
- `BlogPosting` JSON-LD for `post.html` pages
- `Article` / `BlogPosting` JSON-LD when `schema_type` is set
- `FAQPage` JSON-LD when `faqs` array is present in frontmatter
- `BreadcrumbList` JSON-LD when `breadcrumb` array is present in frontmatter
- `WebSite` + `Organization` JSON-LD on the homepage

This means a minimal `base.html` with an empty `<head>` produces a fully-tagged document. Add stylesheet links or other head content on top — the injected block always appears immediately before `</head>`.

---

## Good uses

- Customising the visual design via CSS in `base.html`
- Adding site-wide scripts or analytics in `base.html`
- Creating specialised layouts for different content types (landing pages, documentation, etc.)
- Building reusable partials for headers, CTAs, or other recurring fragments

## Do not use it for

- Storing content — put that in `content/` Markdown files
- Business logic or data transformations — templates are presentation only
- Duplicating Schema.org markup that the auto-injection system already handles

---

## Public APIs

### Read

```ts
api.read.listTemplates(dir)          // → TemplateSummary[]
api.read.getTemplate(dir, name)      // → string  (raw HTML source)
```

### Write

```ts
api.write.writeTemplate(dir, name, html)
api.write.deleteTemplate(dir, name)
```
