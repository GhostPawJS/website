# @ghostpaw/website — Developer Reference

This document is for human operators and developers using this package directly in code. If you are wiring it into an LLM agent, read [LLM.md](LLM.md) instead.

## Requirements

- Node.js 24+
- No database, no framework — everything is files on disk

## Installation

```bash
npm install @ghostpaw/website
```

## Import

```ts
import { api, buildSite, scaffold, SiteError, isSiteError } from '@ghostpaw/website';
```

All runtime functionality flows through three namespaces: `api.read`, `api.write`, and `api.build`. Every function takes `dir: string` as its first argument — the root of your site on disk.

---

## api.read

All functions are async. None have side effects.

### Pages

```ts
api.read.listPages(dir, filter?)     // → PageSummary[]
api.read.getPage(dir, path)          // → PageDetail  (includes rendered HTML)
```

`filter` accepts `{ collection?, url? }`. `url` is matched as a prefix.

`PageSummary` shape:

```ts
{
  path: string,           // relative path from project root, e.g. "content/blog/post.md"
  url: string,
  collection: string | null,
  frontmatter: PageFrontmatter,
  wordCount: number,
  readability: ReadabilityScores,
}
```

### Templates

```ts
api.read.listTemplates(dir)          // → TemplateSummary[]
api.read.getTemplate(dir, name)      // → string  (raw HTML source)
```

### Assets

```ts
api.read.listAssets(dir, filter?)    // → AssetSummary[]
api.read.getAsset(dir, path)         // → AssetDetail  (content included for text types)
```

### Data

```ts
api.read.listData(dir)               // → DataSummary[]
api.read.getData(dir, name)          // → unknown  (parsed JSON)
```

`name` is the bare filename without `.json` extension.

### Site config and identity

```ts
api.read.getConfig(dir)              // → SiteConfig
api.read.getDomain(dir)              // → string  (DOMAIN.md content)
api.read.getPersona(dir)             // → string  (PERSONA.md content)
api.read.getStructure(dir)           // → SiteStructure  (URL tree with parent/child relationships)
```

`SiteConfig` shape:

```ts
{
  name: string,
  url: string,
  language: string,
  author?: string,
}
```

### Fitness

```ts
api.read.fitness(dir, opts?)         // → FitnessReport
api.read.fitnessPage(dir, path)      // → PageScore
api.read.fitnessHistory(dir)         // → FitnessHistoryEntry[]
```

`opts` accepts `{ dimensions?: string[], searchConsole?: GscData }`.

`FitnessReport` shape:

```ts
{
  overall: number,                   // 0–100
  timestamp: number,                 // Unix ms
  dimensions: Record<string, DimensionScore>,
  pages: Record<string, PageScore>,
  clusters: TopicalCluster[],
  cannibalization: CannibalizationPair[],
}
```

Each `Issue` carries:

| Field | Type | Notes |
|-------|------|-------|
| `severity` | `'error' \| 'warning' \| 'info'` | Errors block production launch |
| `dimension` | `string` | Analyzer that raised the issue |
| `code` | `string` | Stable machine-readable identifier |
| `message` | `string` | Human-readable description |
| `page` | `string` | Affected page URL |
| `fix` | `{ file, action, field? }` | Actionable pointer to the exact change needed |

---

## api.write

All functions are async and mutate disk. They are idempotent — calling the same write twice produces the same result.

### Pages

```ts
api.write.writePage(dir, path, frontmatter, markdown)
api.write.deletePage(dir, path)
```

`path` is relative to `content/` (e.g. `'blog/my-post.md'`). Frontmatter is a plain object; all fields are optional except `title` and `layout`.

### Templates

```ts
api.write.writeTemplate(dir, name, html)
api.write.deleteTemplate(dir, name)
```

### Assets

```ts
api.write.writeAsset(dir, path, content)
api.write.deleteAsset(dir, path)
```

`path` is relative to `assets/` (e.g. `'css/styles.css'`).

### Data

```ts
api.write.writeData(dir, name, json)
api.write.deleteData(dir, name)
```

`name` is the bare filename without `.json` extension. The file is written to `data/{name}.json`.

### Site config and identity

```ts
api.write.writeConfig(dir, partial)     // merges partial into site.json
api.write.writeDomain(dir, content)     // replaces DOMAIN.md
api.write.writePersona(dir, content)    // replaces PERSONA.md
```

---

## api.build

### Build

```ts
api.build.build(dir, opts?)
// → BuildResult: { pages: RenderedPage[], skipped: number, manifest: BuildManifest, fitness: null, duration: number }
```

`opts` accepts `{ skipClean?: boolean, incremental?: boolean }`. With `incremental: true`, only pages whose source file changed since the last build are re-rendered — the `skipped` count reflects pages that were left untouched.

Discovers all pages, renders them via the template system, copies assets to `dist/`, and writes `sitemap.xml`.

### Scaffold

```ts
api.build.scaffold(dir, opts?)
// opts: { name?: string, url?: string, language?: string }
```

Creates the full site skeleton on disk. Idempotent — existing files are not overwritten. Writes:

| File | Notes |
|------|-------|
| `site.json` | Site configuration |
| `DOMAIN.md` | Domain knowledge context |
| `PERSONA.md` | Site voice and audience definition |
| `templates/base.html` | Top-level shell |
| `templates/page.html` | Standard page layout |
| `templates/post.html` | Blog/article layout |
| `templates/blog.html` | Collection listing layout |
| `templates/nav.html` | Navigation partial |
| `templates/footer.html` | Footer partial |
| `templates/faq.html` | FAQ building block (Schema.org auto-injected) |
| `templates/breadcrumb.html` | Breadcrumb partial (Schema.org auto-injected) |
| `templates/table.html` | Table building block (Schema.org-ready) |
| `assets/css/style.css` | Minimal base stylesheet |
| `assets/robots.txt` | Permissive robots.txt with sitemap reference |
| `assets/favicon.svg` | Placeholder favicon |
| `data/nav.json` | Navigation data |
| `content/index.md` | Homepage |
| `content/about.md` | About page |

### Preview and dev server

```ts
api.build.preview(dir, path)         // → RenderedPage  (renders one page without writing to dist/)
api.build.serve(dir, opts?)          // → ServeInstance  (dev server with file watching)
api.build.stop(dir)                  // stops the dev server
api.build.clean(dir)                 // deletes dist/
```

---

## Error handling

All `api.read` functions throw on missing resources. All `api.write` functions create missing parent directories automatically.

```ts
import { isSiteError } from '@ghostpaw/website';

try {
  await api.read.getPage(dir, '/nonexistent/');
} catch (err) {
  if (isSiteError(err)) {
    console.error(err.code);   // 'not_found' | 'parse_error' | 'build_error' | ...
  }
}
```

---

## Typical workflow

1. **Scaffold** — `scaffold(dir, opts)` to create the site skeleton.
2. **Edit content** — write pages with `api.write.writePage`, templates with `api.write.writeTemplate`.
3. **Build** — `buildSite(dir)` to produce the `dist/` output.
4. **Check fitness** — `api.read.fitness(dir)` to surface issues across all dimensions.
5. **Fix issues** — use `api.write` calls targeting the `fix` pointers in each issue.
6. **Preview** — `api.build.serve(dir)` to spin up the dev server locally.
7. **Repeat** — keep the fix → rebuild → check loop until all errors are resolved.
