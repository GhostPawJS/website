# @ghostpaw/website

[![npm](https://img.shields.io/npm/v/@ghostpaw/website)](https://www.npmjs.com/package/@ghostpaw/website)
[![node](https://img.shields.io/badge/node-%3E%3D24-brightgreen)](https://nodejs.org)
[![license](https://img.shields.io/npm/l/@ghostpaw/website)](LICENSE)
[![dependencies](https://img.shields.io/badge/runtime%20deps-1-brightgreen)](package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org)

A lean static site builder where the fitness system is the product. Nineteen analyzers across four tiers, LLM-native tooling, and zero-config Schema.org — all driven by files on disk.

## Install

```bash
npm install @ghostpaw/website
```

Requires **Node.js 24+**.

## Core idea

Every build produces a fitness report alongside the HTML. The score is not a grade — it is a prioritised list of specific things to fix: missing canonical URLs, thin content, broken internal links, Schema.org gaps, voice-search disqualifiers. Fix them, rebuild, and the score moves.

The same system works for both humans writing code and LLM agents operating through tools.

## Two audiences

### Human developers

Use the `api.read`, `api.write`, and `api.build` namespaces for direct programmatic access:

```ts
import { scaffold, buildSite, api } from '@ghostpaw/website';

// Bootstrap a working site
await scaffold('./my-site', { name: 'Acme', url: 'https://acme.com' });

// Build to dist/
const result = await buildSite('./my-site');
console.log(result.pages.length); // 7

// Check fitness across all 19 analyzers
const report = await api.read.fitness('./my-site');
console.log(report.overall); // 85
```

See [docs/HUMAN.md](docs/HUMAN.md) for the full direct-API reference.

### LLM agents

Use the `tools`, `skills`, and `soul` namespaces for the structured LLM runtime:

```ts
import { tools, skills, soul } from '@ghostpaw/website';

// Soul: inject into system prompt
const systemPrompt = soul.siteBuilderPersona.renderSoulPromptFoundation();

// Tools: register with your LLM harness
const toolDefs = tools.TOOLS; // JSON Schema + call(dir, input) → ToolResult

// Skills: inject into reasoning steps
const skill = skills.SKILLS.find(s => s.name === 'create-page-well');
```

Every tool returns a discriminated `ToolResult`:

```ts
{ status: 'success',             data: T }
{ status: 'no_op',               message: string }
{ status: 'needs_clarification', question: string }
{ status: 'error',               code: string, message: string }
```

See [docs/LLM.md](docs/LLM.md) for the full agent-builder reference.

## Tools

| Tool | What it does |
|------|-------------|
| `site_read` | Inspect pages, templates, data, config, and fitness reports — no side effects |
| `site_write` | Create, update, or delete content, templates, data, and assets |
| `site_build` | Build, scaffold, preview, serve, or clean a site |
| `site_check` | Run the fitness system and return prioritised issues with fix suggestions |
| `site_plan` | Dry-run proposed changes and preview the fitness delta before writing |

## Skills

| Skill | What it guides |
|-------|---------------|
| `create-page-well` | End-to-end page creation with correct frontmatter and content structure |
| `seo-checklist` | Systematic on-page SEO review and remediation loop |
| `geo-optimization` | GEO signal optimisation: crawlability, interrogative headings, freshness |
| `template-composition` | Building and wiring reusable layout templates and data files |
| `site-launch-checklist` | Pre-launch fitness targets and configuration verification |
| `content-cannibalization` | Identifying and resolving keyword overlap across pages |
| `search-console-workflow` | Ingesting GSC data to drive Tier 4 fitness analysis |

## Core agent loop

```
site_read (understand) → site_plan (simulate) → site_write (apply) → site_check (verify)
```

Repeat until all errors are resolved and overall score meets the target (≥ 80 for launch, ≥ 90 for production excellence).

## Fitness analyzers

| Tier | Analyzers |
|------|-----------|
| **Tier 1** — always runs | `seo_meta`, `seo_structure`, `content_quality`, `images`, `links`, `social`, `sitemap_robots`, `technical` |
| **Tier 2** — TF-IDF | `cannibalization`, `topical_clusters`, `content_tfidf` |
| **Tier 3** — schema | `schema_validation`, `geo`, `eeat`, `local_seo`, `multilingual`, `voice_compliance` |
| **Tier 4** — optional | `search_console` (requires GSC data) |

See [docs/entities/FITNESS.md](docs/entities/FITNESS.md) for the full analyzer reference.

## Key properties

- **Fitness-first.** Score and issues are first-class outputs, not afterthoughts.
- **LLM-native.** Soul for posture, tools for actions, skills for workflow — designed for agentic use from day one.
- **Zero-config Schema.org.** `faq.html`, `breadcrumb.html`, and `table.html` building-block templates auto-inject correct JSON-LD from frontmatter. No manual markup.
- **Dry-run before write.** `site_plan` simulates any mutation and returns a fitness delta before a single file is touched.
- **Everything is files.** `content/`, `templates/`, `assets/`, `data/`, `site.json` — no database, no admin UI, no hidden state.
- **Resilient tool surface.** Missing `path` returns `needs_clarification`. `page:` and `url:` accepted as aliases for `path`. `.json` extension in data names stripped automatically.
- **One runtime dependency.** Only `marked` — for Markdown rendering.

## Package surface

```ts
import {
  // Convenience re-exports
  buildSite,
  scaffold,

  // Structured API namespaces
  api,     // api.read  /  api.write  /  api.build

  // LLM runtime
  tools,   // TOOLS array  +  siteRead, siteWrite, siteBuild, siteCheck, sitePlan
  skills,  // SKILLS array  +  7 named skills
  soul,    // siteBuilderPersona  (renderSoulPromptFoundation())

  // Types
  type FitnessReport,
  type PageScore,
  type DryRunChange,
  type GscData,
  type SiteConfig,
} from '@ghostpaw/website';
```

## Documentation

| Document | Audience |
|----------|---------|
| [docs/HUMAN.md](docs/HUMAN.md) | Human developers using `api.read` / `api.write` / `api.build` directly |
| [docs/LLM.md](docs/LLM.md) | Agent builders wiring `soul`, `tools`, and `skills` into an LLM harness |
| [docs/entities/CONTENT.md](docs/entities/CONTENT.md) | Pages, frontmatter schema, collections, URL routing |
| [docs/entities/TEMPLATES.md](docs/entities/TEMPLATES.md) | Handlebars templates, layouts, partials, auto-injected Schema.org |
| [docs/entities/FITNESS.md](docs/entities/FITNESS.md) | 19 fitness analyzers, scoring, issue format, history |

## Development

```bash
npm install
npm test            # node:test runner, no external framework
npm run typecheck   # tsc --noEmit
npm run lint        # biome check
npm run build       # ESM + CJS + declarations via tsup
```

### Support

If this package helps your project, consider sponsoring its maintenance:

[![GitHub Sponsors](https://img.shields.io/badge/Sponsor-EA4AAA?style=for-the-badge&logo=github&logoColor=white)](https://github.com/sponsors/Anonyfox)

---

Part of the [GhostPaw](https://github.com/GhostPawJS) ecosystem.

**[Anonyfox](https://anonyfox.com) • [MIT License](LICENSE)**
