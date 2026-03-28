# @ghostpaw/website

[![npm](https://img.shields.io/npm/v/@ghostpaw/website)](https://www.npmjs.com/package/@ghostpaw/website)
[![node](https://img.shields.io/node/v/@ghostpaw/website)](https://nodejs.org)
[![license](https://img.shields.io/npm/l/@ghostpaw/website)](LICENSE)
[![dependencies](https://img.shields.io/badge/dependencies-1-brightgreen)](package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Live Demo](https://img.shields.io/badge/demo-live-06d6a0?style=flat&logo=github)](https://ghostpawjs.github.io/website)

A lean static site builder where the fitness system is the product: 19 analyzers across 4 tiers, LLM-native tooling, and zero-config Schema.org — all driven by files on disk.

## Install

```bash
npm install @ghostpaw/website
```

Requires **Node.js 22+** (uses `--experimental-strip-types`).

## Quick Start

```ts
import { scaffold, build, api } from '@ghostpaw/website';

// Create a working site in seconds
await scaffold('./my-site');

// Build it
await build('./my-site');

// Check fitness across all 19 analyzers
const report = await api.read.fitness('./my-site');
console.log(report.score, report.issues);
```

## Two Audiences

### Human developers

Use the `api.read`, `api.write`, and `api.build` namespaces for direct programmatic access to every site operation:

```ts
import { api } from '@ghostpaw/website';

// Read
const pages = await api.read.listPages('./my-site');
const page  = await api.read.getPage('./my-site', 'about');
const score = await api.read.fitnessPage('./my-site', 'about');

// Write
await api.write.writePage('./my-site', 'about', { title: 'About Us', body: '...' });

// Build
await api.build.build('./my-site');
await api.build.preview('./my-site');
```

See [docs/HUMAN.md](docs/HUMAN.md) for the full human-facing guide.

### LLM agents

Use the `tools`, `skills`, and `soul` namespaces for a structured runtime surface designed to minimise LLM cognitive load:

```ts
import { tools, skills, soul } from '@ghostpaw/website';

// Intent-shaped tools with JSON Schema inputs and structured results
const allTools = tools.TOOLS;

// Reusable workflow skills for common multi-step scenarios
const allSkills = skills.SKILLS;

// Thinking foundation for system prompts
const prompt = soul.siteBuilderPersona.renderSoulPromptFoundation();
```

Every tool returns a discriminated result with `outcome: 'success' | 'no_op' | 'needs_clarification' | 'error'`, structured data, next-step hints, and actionable recovery advice.

See [docs/LLM.md](docs/LLM.md) for the full AI-facing guide.

## Tools

| Tool          | What it does                                                             |
|---------------|--------------------------------------------------------------------------|
| `site_read`   | Inspect pages, templates, data, config, and fitness reports              |
| `site_write`  | Create, update, or delete content, templates, data, and assets           |
| `site_build`  | Build, preview, serve, stop, clean, or scaffold a site                   |
| `site_check`  | Run the fitness system; returns prioritised issues with fix suggestions   |
| `site_plan`   | Dry-run changes and preview the fitness delta before writing             |

## Skills

| Skill                        | What it guides                                                  |
|------------------------------|-----------------------------------------------------------------|
| `create-page-well`           | End-to-end page creation with correct frontmatter and structure |
| `seo-checklist`              | Systematic on-page SEO review and remediation                   |
| `geo-optimization`           | Geographic and local SEO signal optimisation                    |
| `template-composition`       | Building and wiring reusable layout templates                   |
| `site-launch-checklist`      | Pre-launch fitness and configuration verification               |
| `content-cannibalization`    | Identifying and resolving keyword overlap across pages          |
| `search-console-workflow`    | Ingesting GSC data to drive Tier 4 fitness analysis             |

## Core LLM Workflow Loop

The recommended agent loop is: **plan, write, check**.

```ts
import { tools } from '@ghostpaw/website';

const { siteRead, siteWrite, siteBuild, siteCheck, sitePlan } = tools;

// 1. Simulate — preview fitness impact before touching the site
const delta = await sitePlan.handler(site, { action: 'writePage', slug: 'services', data: draft });

// 2. Apply — write the change only when the delta looks good
await siteWrite.handler(site, { action: 'writePage', slug: 'services', data: draft });

// 3. Verify — confirm fitness improved and surface any remaining issues
const report = await siteCheck.handler(site, { tiers: ['tier1', 'tier2'] });
```

`site_plan` (simulate) → `site_write` (apply) → `site_check` (verify)

## Key Properties

- **Fitness-first.** 19 analyzers across 4 tiers run on every build. The score is a first-class output, not an afterthought.
- **LLM-native.** `soul` for posture, `tools` for actions, `skills` for workflow guidance — designed for agentic use from day one.
- **Zero-config Schema.org.** `faq.html`, `breadcrumb.html`, and `table.html` building-block templates auto-inject correct JSON-LD from frontmatter. No manual markup needed.
- **Dry-run before write.** `site_plan` simulates any mutation and returns a fitness delta before a single file is touched.
- **Everything is files.** `content/`, `templates/`, `assets/`, `data/`, `site.json` — no database, no admin UI, no hidden state.
- **Multi-language ready.** Multilingual and geo analyzers are built in; no plugin required.
- **One runtime dependency.** Only `marked` — for Markdown rendering.
- **scaffold() in seconds.** A fully working site with correct structure in one call.

## Fitness Analyzers (19 total)

| Tier | Analyzers |
|------|-----------|
| **Tier 1** — always | `seo_meta`, `seo_structure`, `content_quality`, `images`, `links`, `social`, `sitemap_robots`, `technical` |
| **Tier 2** — TF-IDF | `cannibalization`, `topical_clusters`, `content_tfidf` |
| **Tier 3** — schema  | `schema_validation`, `geo`, `eeat`, `local_seo`, `multilingual`, `voice_compliance` |
| **Tier 4** — optional | `search_console` (when GSC data is provided) |

## Package Surface

```ts
import {
  // Convenience re-exports
  buildSite,
  scaffold,

  // Structured API namespaces
  api,   // api.read — api.write — api.build

  // LLM runtime
  tools, // TOOLS array + siteRead, siteWrite, siteBuild, siteCheck, sitePlan
  skills, // SKILLS array + 7 named skills
  soul,  // siteBuilderPersona (with renderSoulPromptFoundation())

  // Types
  type GscData,
  type GscRow,
  type FitnessReport,
  type PageScore,
  type FitnessOptions,
} from '@ghostpaw/website';
```

### `api.read`

`listPages`, `getPage`, `listTemplates`, `getTemplate`, `listAssets`, `getAsset`, `listData`, `getData`, `getConfig`, `getDomain`, `getPersona`, `getStructure`, `fitness`, `fitnessPage`, `fitnessHistory`

### `api.write`

`writePage`, `deletePage`, `writeTemplate`, `deleteTemplate`, `writeAsset`, `deleteAsset`, `writeData`, `deleteData`, `writeConfig`, `writeDomain`, `writePersona`

### `api.build`

`build`, `scaffold`, `preview`, `serve`, `stop`, `clean`

## Documentation

| Document | Audience |
|---|---|
| [docs/HUMAN.md](docs/HUMAN.md) | Human developers using the low-level `api.read` / `api.write` surface |
| [docs/LLM.md](docs/LLM.md) | Agent builders wiring `soul`, `tools`, and `skills` into LLM systems |

## Development

```bash
npm install
npm test            # node:test runner (--experimental-strip-types)
npm run typecheck   # tsc --noEmit
npm run lint        # biome check
npm run build       # ESM + CJS + declarations via tsup
```

The repo is pinned to **Node 22+** via `.nvmrc` / `.node-version` / `.tool-versions` / Volta.

### Support

If this package helps your project, consider sponsoring its maintenance:

[![GitHub Sponsors](https://img.shields.io/badge/Sponsor-EA4AAA?style=for-the-badge&logo=github&logoColor=white)](https://github.com/sponsors/Anonyfox)

---

**[Anonyfox](https://anonyfox.com) • [MIT License](LICENSE)**
