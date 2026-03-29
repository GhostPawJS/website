# @ghostpaw/website — Agent Skill

## What this is

A `@ghostpaw/website` project is a file-based static site builder. The CLI manages the full lifecycle: scaffolding, building, fitness checking, and deployment. The fitness system scores the site across 19 dimensions (SEO, GEO, content quality, voice compliance, schema validation, and more) and returns machine-actionable fix suggestions for every issue.

**CWD rule**: every command except `init` must be run from the project root — the directory that contains `site.json`.

---

## The agent loop

```
website check --json        ← get current score + issue list
→ read issues, identify fixes
→ edit content/*.md or use write commands
website build               ← rebuild dist/
website check --json        ← verify improvement
```

---

## Commands

| Command | Description | `--json` output |
|---|---|---|
| `website check --json` | Full fitness report, all 19 analyzers | `FitnessReport` |
| `website check --page /url/ --json` | Single-page score (Tier 1 + Tier 3 only) | `PageScore` |
| `website build` | Full build to dist/, pre-compress assets | — |
| `website new page <slug>` | Create a page with correct frontmatter | — |
| `website new post <slug>` | Create a blog post with correct frontmatter | — |
| `website config get [key]` | Read site.json or a nested key | JSON value |
| `website config set <key> <val>` | Update a site.json value | — |
| `website deploy --github-pages` | Write GitHub Actions workflow | — |
| `website deploy --netlify` | Write netlify.toml | — |
| `website deploy --cloudflare` | Print Cloudflare Pages setup | — |
| `website deploy --docker` | Write Dockerfile for self-hosting | — |
| `website dev` | Dev server with livereload (human use) | — |
| `website start` | Production HTTP server (serves dist/) | — |

Exit code is `1` when `website check` finds error-severity issues, or when `website build --threshold N` is below N. Use this for CI pipelines.

---

## What to edit directly

`content/*.md` files — YAML frontmatter + markdown body. Create, edit, and delete these freely. The build pipeline re-renders on `website build`.

**Frontmatter fields that matter for fitness:**

```yaml
---
title: "Page Title"          # 50–60 chars, keyword front-loaded
description: "..."           # 155–160 chars, includes CTA
layout: page.html            # or post.html, blog.html, etc.
datePublished: 2025-01-15    # ISO date
dateModified: 2025-06-01     # ISO date — update when content changes
keyword: "primary keyword"   # target search term
og_image: /assets/og.jpg     # Open Graph image
author: "Name"               # required for post.html (E-E-A-T)
schema_type: Article         # activates schema-aware analyzers
---
```

---

## What to use CLI for

- `site.json` changes → `website config set <key> <value>`
- New content → `website new page <slug>` or `website new post <slug>`
- Deployment setup → `website deploy --<provider>`

**Do not touch:**
- `dist/` — overwritten on every build
- `.build-manifest.json` — managed by build pipeline
- `.fitness-history.json` — managed by fitness pipeline

---

## FitnessReport shape

```json
{
  "overall": 82,
  "dimensions": {
    "seo_meta": {
      "score": 94,
      "issues": [{ "severity": "warning", "dimension": "seo_meta", "code": "...", "message": "...", "page": "/about/", "fix": { "file": "content/about.md", "action": "set_frontmatter", "field": "og_image", "value": "/assets/og-about.jpg" } }]
    }
  },
  "pages": {
    "/about/": { "score": 80, "wordCount": 420, "issues": [...], "tfidfTopTerms": ["solar", "tracker", "installation"] }
  },
  "cannibalization": [{ "pageA": "/blog/a/", "pageB": "/blog/b/", "similarity": 0.81, "suggestion": "merge" }],
  "clusters": [{ "id": "blog", "pillar": "/blog/", "pages": ["/blog/a/", "/blog/b/"], "missingPillar": false }]
}
```

---

## Issue and fix shape

```json
{
  "severity": "error | warning | info",
  "dimension": "seo_meta",
  "code": "missing_og_image",
  "message": "og:image not set",
  "page": "/blog/post/",
  "fix": {
    "file": "content/blog/post.md",
    "action": "set_frontmatter",
    "field": "og_image",
    "value": "/assets/images/blog-post.jpg"
  }
}
```

**Fix actions**: `set_frontmatter`, `add_content`, `update_content`, `update_template`, `add_asset`, `create_file`, `merge_into`, `redirect`, `remove`

Each fix maps directly to an edit you can make to the file named in `fix.file`.

---

## Fitness score targets

| Score | Status |
|---|---|
| ≥ 90 | Launch-ready — no significant gaps |
| ≥ 80 | Healthy — safe to publish |
| 60–79 | Needs attention before launch |
| < 60 | Significant issues — address errors first |

---

## Recommended first steps on any project

1. `website check --json` — understand the current state
2. Read `DOMAIN.md` — what this site is about, who it's for
3. Read `PERSONA.md` — voice, tone, style rules
4. Fix `error` severity issues first (they lower the score most)
5. Then `warning` severity, then `info`
6. `website build` after each batch of fixes
7. `website check --json` to confirm the score moved

---

## Analyzer dimensions

The 19 analyzers are grouped into four tiers:

**Tier 1 — always-on**: `seo_meta`, `seo_structure`, `content_quality`, `images`, `links`, `social`, `sitemap_robots`, `technical`

**Tier 2 — content intelligence** (TF-IDF, corpus-wide): `cannibalization`, `topical_clusters`, `content_tfidf`

**Tier 3 — schema-aware** (activate when relevant schema detected): `schema_validation`, `geo`, `eeat`, `local_seo`, `multilingual`, `voice_compliance`

**Tier 4 — impact analysis**: `dry_run`, `search_console`
