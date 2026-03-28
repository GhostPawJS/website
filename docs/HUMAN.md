# @ghostpaw/website — Developer Reference

This document is for human operators and developers using this package directly
in code. If you are wiring it into an LLM agent, read [LLM.md](LLM.md) instead.

## Requirements

- Node 22+
- No database, no framework — everything is files on disk

## Installation

```sh
npm install @ghostpaw/website
```

## Import

```ts
import { api, buildSite, scaffold, SiteError, isSiteError } from '@ghostpaw/website';
```

All runtime functionality flows through three namespaces: `api.read`, `api.write`,
and `api.build`. Every function takes `dir: string` as its first argument — the
root of your site on disk.

---

## api.read

All functions are async.

### Pages

```ts
api.read.listPages(dir, filter?)     // → PageSummary[]
api.read.getPage(dir, path)          // → PageDetail  (includes rendered HTML)
```

`filter` accepts `{ tag?, template?, slug? }`. `slug` is matched as a pattern.

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

### Site config and identity

```ts
api.read.getConfig(dir)              // → SiteConfig
api.read.getDomain(dir)              // → string  (DOMAIN.md content)
api.read.getPersona(dir)             // → string  (PERSONA.md content)
api.read.getStructure(dir)           // → SiteStructure  (URL tree with parent/child relationships)
```

### Fitness

```ts
api.read.fitness(dir, opts?)         // → FitnessReport
api.read.fitnessPage(dir, path)      // → PageScore  (Tier 1 + Tier 3 only)
api.read.fitnessHistory(dir)         // → FitnessHistoryEntry[]
```

`opts` accepts `{ dimensions?: string[], searchConsole? }`.

#### FitnessReport shape

```ts
{
  overall: number,
  timestamp: string,
  dimensions: Record<string, DimensionScore>,
  pages: Record<string, PageScore>,
  cannibalization: CannibalizationPair[]
}
```

Each issue carries:

| Field | Type | Notes |
|-------|------|-------|
| `severity` | `'error' \| 'warning' \| 'info'` | |
| `dimension` | `string` | |
| `code` | `string` | Stable identifier |
| `message` | `string` | Human-readable description |
| `page` | `string` | Affected page path |
| `fix` | `{ file, action, field }` | Actionable pointer to the exact change needed |

---

## api.write

### Pages

```ts
api.write.writePage(dir, path, frontmatter, markdown)
api.write.deletePage(dir, path)
```

`path` is relative to `content/`.

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

### Data

```ts
api.write.writeData(dir, name, json)
api.write.deleteData(dir, name)
```

### Site config and identity

```ts
api.write.writeConfig(dir, partial)     // merges partial into site.json
api.write.writeDomain(dir, content)     // replaces DOMAIN.md
api.write.writePersona(dir, content)    // replaces PERSONA.md
```

---

## api.build

```ts
api.build.build(dir, opts?)             // → BuildResult  (copies assets, renders all pages, writes to dist/)
api.build.scaffold(dir, opts?)          // creates full site skeleton on disk
api.build.preview(dir, path)            // → RenderedPage  (renders one page without writing to dist/)
api.build.serve(dir, opts?)             // → ServeInstance  (dev server with file watching)
api.build.stop(dir)                     // stops the dev server
```

### Scaffold options

```ts
{ name?: string, url?: string, language?: string }
```

Scaffold creates: `site.json`, `DOMAIN.md`, `PERSONA.md`, all templates,
`content/index.md`, `content/about.md`, assets, and data.

Templates written by scaffold:

| Template | Notes |
|----------|-------|
| `base.html` | Top-level shell |
| `page.html` | Standard page |
| `post.html` | Blog/article |
| `nav.html` | Navigation partial |
| `footer.html` | Footer partial |
| `faq.html` | Building block — Schema.org JSON-LD injected automatically |
| `breadcrumb.html` | Building block — Schema.org JSON-LD injected automatically |
| `table.html` | Building block — Schema.org JSON-LD injected automatically |

---

## Error handling

```ts
import { isSiteError } from '@ghostpaw/website';

try {
  await api.read.getPage(dir, path);
} catch (err) {
  if (isSiteError(err)) {
    console.error(err.code);   // SiteErrorCode union
  }
}
```

---

## Typical workflow

1. **Scaffold** — `api.build.scaffold(dir, opts)` to create the site skeleton
2. **Edit content** — write or update pages with `api.write.writePage`
3. **Check fitness** — `api.read.fitness(dir)` to surface issues across all dimensions
4. **Fix issues** — use `api.write` calls targeting the `fix` pointers in each issue
5. **Build** — `api.build.build(dir)` to produce the `dist/` output
6. **Preview** — `api.build.serve(dir)` to spin up the dev server locally
