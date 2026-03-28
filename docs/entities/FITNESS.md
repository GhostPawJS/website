# Fitness system

## What it is

The fitness system is the package's primary feedback mechanism. It runs a battery of 19 analyzers against the built site and produces a score (0–100) for each dimension plus an overall score, a ranked issue list, and per-page scores.

The score is not a report card. It is a prioritised list of specific things to fix. Every issue includes a `fix` pointer — the exact file, action, and field that resolves it.

## Why it exists

Static sites degrade silently. A missing `og:image` on a blog post, a broken internal link from a footer update, thin word count after a page restructure — none of these produce build errors. The fitness system makes invisible problems visible on every build.

It is also the primary signal for LLM agents: run `site_check` after any batch of writes to confirm the score moved in the right direction.

---

## Tiers

Analyzers run in tiers. Higher tiers require more compute and/or external data; lower tiers are always fast.

| Tier | When it runs | Analyzers |
|------|-------------|-----------|
| **1** | Always | `seo_meta`, `seo_structure`, `content_quality`, `images`, `links`, `social`, `sitemap_robots`, `technical` |
| **2** | Always (TF-IDF) | `cannibalization`, `topical_clusters`, `content_tfidf` |
| **3** | Always (schema) | `schema_validation`, `geo`, `eeat`, `local_seo`, `multilingual`, `voice_compliance` |
| **4** | When GSC data provided | `search_console` |

---

## Analyzers

### Tier 1

**`seo_meta`** — title tags, meta descriptions, canonical URLs, Open Graph tags, Twitter card tags.

**`seo_structure`** — heading hierarchy (one `<h1>`, logical nesting), URL patterns, slug quality.

**`content_quality`** — word count thresholds (300 for `page` layout, 1,000 for `post` layout), readability scores, keyword density, sentence and paragraph structure.

**`images`** — `alt` text presence, image path validity, file size signals.

**`links`** — broken internal links, external link attributes (`rel="noopener"`), orphaned pages (no inbound links from other pages).

**`social`** — `og:image` presence, image dimensions, Twitter card completeness.

**`sitemap_robots`** — `sitemap.xml` validity and completeness, `robots.txt` presence and correctness, AI crawler permissions.

**`technical`** — charset declaration, viewport meta tag, canonical URL format consistency.

### Tier 2

**`cannibalization`** — TF-IDF similarity scores across page pairs. Flags pairs above the threshold as potential keyword cannibalization risks.

**`topical_clusters`** — pillar/cluster structure analysis. Detects orphaned supporting pages and missing pillar pages.

**`content_tfidf`** — term frequency and keyword relevance signals per page. Checks whether the declared `keyword` frontmatter field actually dominates the content.

### Tier 3

**`schema_validation`** — validates JSON-LD blocks for correct `@type`, required fields, and structural validity.

**`geo`** — GEO (Generative Engine Optimization) signals: AI crawler allowances in `robots.txt`, interrogative headings, citation patterns, entity mentions, factual density.

**`eeat`** — E-E-A-T signals: author attribution, publication dates, external citations, organisational trust signals.

**`local_seo`** — local business signals: NAP consistency, local schema types, location mentions.

**`multilingual`** — `hreflang` tags, language consistency between `site.json` and content, language declaration completeness.

**`voice_compliance`** — voice search optimisation: speakable content, question-answer patterns, direct answer eligibility, featured snippet signal strength.

### Tier 4

**`search_console`** — incorporates live performance data from Google Search Console when provided. Detects low-CTR pages, keyword opportunities, content gaps, and URL flickering patterns. Performance data outranks all static analysis signals.

---

## Scoring

Each dimension produces a score 0–100. The overall score is the weighted mean of all dimension scores.

Per-page scores are computed from the issues affecting that page:
- Each `error` reduces the page score significantly
- Each `warning` reduces it moderately
- `info` items have minimal impact

A page with no issues scores 100. The `weakestPages` field in `FitnessReport` lists the five lowest-scoring pages — these are the highest-priority targets.

---

## Issue format

```ts
{
  severity:  'error' | 'warning' | 'info',
  dimension: string,     // analyzer name, e.g. 'seo_meta'
  code:      string,     // stable identifier, e.g. 'seo_meta/missing_og_image'
  message:   string,     // human-readable description
  page:      string,     // affected page URL, e.g. '/blog/my-post/'
  fix: {
    file:    string,     // absolute path to the file that needs editing
    action:  string,     // 'set_frontmatter' | 'add_content' | 'update_content' | ...
    field?:  string,     // specific frontmatter field, when action is 'set_frontmatter'
  },
}
```

### Issue severity guide

| Severity | What it means | Fix urgency |
|----------|-------------|-------------|
| `error` | Missing or broken signal that materially harms search visibility | Before launch |
| `warning` | Suboptimal signal that reduces potential | Before production excellence |
| `info` | Enhancement opportunity or minor deviation | When convenient |

Fix errors before warnings. The `fix` pointer tells you exactly which file to edit, what action to take, and which field to set.

---

## FitnessReport shape

```ts
{
  overallScore: number,              // 0–100
  timestamp: string,                 // ISO 8601
  dimensions: {
    [name: string]: {
      score: number,
      passCount: number,
      failCount: number,
    }
  },
  topIssues: Issue[],                // up to 20, sorted by severity
  weakestPages: PageScore[],         // up to 5 lowest-scoring pages
  cannibalization: CannibalizationPair[],
}
```

---

## Fitness history

Every `build` run appends a snapshot to `fitness-history.json` in the project root. The history enables trend analysis and regression detection.

```ts
api.read.fitnessHistory(dir)   // → FitnessHistoryEntry[]
```

Each entry:

```ts
{
  timestamp: string,
  overallScore: number,
  dimensionScores: Record<string, number>,
}
```

---

## Search Console integration

Tier 4 analysis requires `GscData`:

```ts
{
  rows: GscRow[],    // one row per (URL, query) pair
  siteUrl: string,
}
```

Each `GscRow`:

```ts
{
  page:        string,    // URL path
  query:       string,    // search query
  clicks:      number,
  impressions: number,
  ctr:         number,
  position:    number,
}
```

Pass it to `api.read.fitness` via `opts.searchConsole`, or to `site_check` via the `searchConsole` field. When present, the `search_console` analyzer adds Tier 4 issues to the report.

---

## Public APIs

### Run fitness

```ts
api.read.fitness(dir, opts?)         // → FitnessReport
api.read.fitnessPage(dir, path)      // → PageScore
api.read.fitnessHistory(dir)         // → FitnessHistoryEntry[]
```

### Via tools

```ts
siteCheck.call(dir, {})                         // full site check
siteCheck.call(dir, { page: '/about/' })         // single-page check
siteCheck.call(dir, { dimensions: ['seo_meta'] }) // scoped check
```

---

## Operating notes

**Score targets**: ≥ 80 is the minimum for a public launch. ≥ 90 is production excellence. The exact mix of issues that gets you there depends on the site — a content-heavy site will hit Tier 1 issues first; a structured data site will surface Tier 3 issues.

**What not to do**: Do not run a full build just to re-score a single page. Use `site_check` with `page:` for single-page verification — it skips the build and runs only the fitness analyzers.

**Cannibalization**: Two pages above the similarity threshold does not always mean one should be deleted. Low-similarity pairs where both rank for the same query are the real risk. The `content-cannibalization` skill has the decision framework.
