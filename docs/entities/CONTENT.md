# Content pages

## What it is

A content page is the fundamental unit of a site: one Markdown file, one URL, one rendered HTML output. It consists of a YAML frontmatter block and a Markdown body.

Files live under `content/`. Directories become URL path segments. The `_index.md` convention marks a collection index page.

## Why it exists

The builder needs one canonical record that answers: what is this page about, how should it render, where does it sit in the site hierarchy, and which signals does it expose to the fitness system?

Keeping content in files (not a database) means the full site state is always readable, diffable, and version-controlled without any tooling beyond git.

---

## Frontmatter schema

All fields are optional except `title` and `layout`. Unknown fields are passed through to the template context under `page.{field}`.

### Required

| Field | Type | Notes |
|-------|------|-------|
| `title` | `string` | Page title. Used in `<title>`, `og:title`, JSON-LD, and `<h1>` by most layouts. |
| `layout` | `string` | Template filename to render into (e.g. `page.html`, `post.html`). |

### SEO and meta

| Field | Type | Notes |
|-------|------|-------|
| `description` | `string` | Meta description and OG description. Aim for 120–160 characters. |
| `og_image` | `string` | OG and Twitter card image URL. Absolute path or full URL. |
| `image` | `string` | Alias for `og_image` — lower priority when both are present. |
| `noindex` | `boolean` | Adds `<meta name="robots" content="noindex">` when `true`. |
| `nofollow` | `boolean` | Adds `nofollow` to the robots directive. |
| `canonical` | `string` | Override the auto-generated canonical URL. |

### Content authorship

| Field | Type | Notes |
|-------|------|-------|
| `date` | `string` | ISO 8601 date. Used as publication date when `datePublished` is absent. |
| `datePublished` | `string` | ISO 8601 publication date. Takes precedence over `date` in sorting and Schema.org. |
| `dateModified` | `string` | ISO 8601 modification date. Used in `BlogPosting` and `Article` JSON-LD. |
| `author` | `string` | Author name. Used in `og:article:author` and Schema.org. |
| `keyword` | `string` | Primary keyword. Used by the fitness system for TF-IDF and cannibalization analysis. |

### Schema.org auto-injection

The build pipeline injects JSON-LD automatically based on the presence of these fields — no manual markup needed.

| Field | Type | Triggers |
|-------|------|---------|
| `schema_type` | `'Article' \| 'BlogPosting'` | Injects an `Article` or `BlogPosting` JSON-LD block. |
| `faqs` | `Array<{ q: string, a: string }>` | Injects a `FAQPage` JSON-LD block. |
| `breadcrumb` | `Array<{ label: string, href: string }>` | Injects a `BreadcrumbList` JSON-LD block. |

Pages with `layout: post.html` also receive `BlogPosting` JSON-LD automatically.

The homepage (`url === '/'`) receives `WebSite` and `Organization` JSON-LD automatically.

### Table building block

| Field | Type | Notes |
|-------|------|-------|
| `tableCaption` | `string` | Table caption text. |
| `tableHeaders` | `string[]` | Column header labels. |
| `tableRows` | `string[][]` | Array of row arrays. |

### Voice search

| Field | Type | Notes |
|-------|------|-------|
| `speakable` | `boolean` | Marks the page as containing speakable content. Used by voice compliance analyzer. |

### Collections

| Field | Type | Notes |
|-------|------|-------|
| `collection` | `string` | Assign this page to a named collection. Derived automatically from the directory path if not set. |
| `pageOrder` | `number` | Sort order within a collection. |
| `tags` | `string[]` | Content tags. Accessible via `list_pages` filters. |

---

## URL routing

The output URL is derived from the file path relative to `content/`:

| File path | Output URL |
|-----------|-----------|
| `content/index.md` | `/` |
| `content/about.md` | `/about/` |
| `content/blog/my-post.md` | `/blog/my-post/` |
| `content/blog/_index.md` | `/blog/` |

Rules:
- All URLs end with a trailing slash.
- Filenames become the last path segment; `.md` is stripped.
- `index.md` at any level maps to the parent path (e.g. `content/blog/index.md` → `/blog/`).
- `_index.md` marks a collection index. Its slug equals its parent directory name.

---

## Collections

A collection is a group of pages under the same directory. The builder discovers collections automatically from the directory structure — no explicit configuration needed.

### Collection index pages

A `_index.md` file at the root of a directory becomes the collection index. Its `slug` equals the collection name (e.g. `blog/_index.md` has `slug: "blog"`).

The index page is separated from the collection's member pages and exposed in the template context as its own rendering target.

### Template context

Collections are available in templates as `collections.{name}` — an array of summary objects sorted newest-first by `datePublished` (falling back to `date`):

```handlebars
{{#each collections.blog as post}}
  <a href="{{ post.url }}">{{ post.title }}</a>
  <time>{{ post.datePublished }}</time>
{{/each}}
```

Each item in the array:

| Field | Notes |
|-------|-------|
| `url` | Page URL |
| `slug` | Page slug |
| `title` | From frontmatter |
| `description` | From frontmatter |
| `date` | From frontmatter |
| `datePublished` | `datePublished ?? date` |
| `dateModified` | From frontmatter |
| `author` | From frontmatter |
| `keyword` | From frontmatter |
| `og_image` | `og_image ?? image` |

Use `blog.html` (scaffolded automatically) as the base for collection listing pages.

---

## Good uses

- Blog posts, documentation pages, landing pages, FAQ pages
- Any content where frontmatter signals (title, description, schema fields) improve search visibility
- Collection-based content (blog, docs, case studies) where newest-first ordering matters

## Do not use it for

- Binary assets — use `assets/` instead
- Structured data that will be reused across pages — use `data/` JSON files instead
- Generated or computed content — the builder expects files authored by humans or LLMs, not programmatic output

---

## Public APIs

### Read

```ts
api.read.listPages(dir, filter?)     // → PageSummary[]
api.read.getPage(dir, path)          // → PageDetail
```

### Write

```ts
api.write.writePage(dir, path, frontmatter, markdown)
api.write.deletePage(dir, path)
```

Or surgically via the tool layer:

```ts
siteWrite.call(dir, { action: 'patch_frontmatter', path: 'blog/post.md', frontmatter: { og_image: '/img.jpg' } })
```
