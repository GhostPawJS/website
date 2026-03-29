# @ghostpaw/website

[![npm](https://img.shields.io/npm/v/@ghostpaw/website)](https://www.npmjs.com/package/@ghostpaw/website)
[![node](https://img.shields.io/badge/node-%3E%3D24-brightgreen)](https://nodejs.org)
[![license](https://img.shields.io/npm/l/@ghostpaw/website)](LICENSE)
[![dependencies](https://img.shields.io/badge/runtime%20deps-2-brightgreen)](package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org)

A lean static site builder where the fitness system is the product. Nineteen analyzers across four tiers, LLM-native tooling, and zero-config Schema.org — all driven by files on disk and one runtime dependency.

---

## Quickstart

```bash
npx @ghostpaw/website init my-site
cd my-site
npm run dev
```

`http://localhost:3000` is live. The fitness report runs automatically. Edit files in `content/` and the browser reloads.

---

## CLI

The `website` binary is the primary interface — for humans and agents alike. Every command runs from the project root (the directory containing `site.json`).

```bash
website init [dir]          # scaffold + first build + package.json scripts
website dev                 # dev server with livereload, per-rebuild feedback
website build               # full build to dist/, pre-compress assets, fitness summary
website check               # 19-analyzer fitness report with actionable fixes
website new page <slug>     # create a page with correct frontmatter
website new post <slug>     # create a blog post with correct frontmatter
website config get [key]    # read site.json or a specific dot-notation key
website config set <key>    # update site.json safely
website deploy              # generate GitHub Pages, Netlify, Cloudflare, or Docker config
website start               # production HTTP server (security headers, gzip, ETag, clean URLs)
```

`--help` works on every command. `--json` on `check` and `build` emits raw structured output for piping.

### Dev server

```
  Local:    http://localhost:3000
  Project:  My Site · 6 pages
  Fitness:  84/100 — 3 issues (run `website check`)

  Watching content/, templates/, data/, assets/
  12:34:01  rebuilt 28ms · 6 pages
```

File watching is incremental — only changed pages re-render. Templates or `site.json` changes trigger a full rebuild.

### Production server

`website start` serves `dist/` over Node's built-in HTTP with no external dependencies:

- Security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`)
- Pre-compressed `.gz` serving without runtime CPU cost (`website build` writes them)
- `Cache-Control: no-cache` + `ETag` for HTML; `immutable` for content-hashed assets
- Clean URL redirects (`/about` → `/about/`) matching CDN behaviour
- Path traversal guard, dotfile protection, graceful `SIGTERM`/`SIGINT` shutdown
- `PORT` env var for containers; `--trust-proxy` for reverse-proxy deployments

### Deployment

```bash
website deploy --github-pages   # writes .github/workflows/pages.yml
website deploy --netlify         # writes netlify.toml
website deploy --cloudflare      # prints Cloudflare Pages setup
website deploy --docker          # writes Dockerfile + .dockerignore
```

Config generation only — no auth, no network calls.

### CLI as an agent interface

Every project created by `website init` includes a `SKILL.md` that explains the full CLI to any agent with shell access. Drop a `@ghostpaw/website` project into Claude Code, Cursor, or any agent that can run commands and read files, and it knows how to:

- Audit the site and surface prioritised issues
- Write new content that passes fitness checks on the first build
- Fix cannibalization, schema gaps, and voice compliance issues
- Rebuild and verify the score improved

The `--json` flag on `check` and `build` returns the raw `FitnessReport` — ready to pipe directly into an LLM API call.

See [docs/LLM.md](docs/LLM.md) for the full agent integration reference, including the library-level `tools`, `skills`, and `soul` namespaces for deeper harness integration.

---

## Library API

For developers who need programmatic access:

```bash
npm install @ghostpaw/website
```

```ts
import { scaffold, buildSite, api } from '@ghostpaw/website';

await scaffold('./my-site', { name: 'Acme', url: 'https://acme.com' });

const result = await buildSite('./my-site');
console.log(result.pages.length); // 6

const report = await api.read.fitness('./my-site');
console.log(report.overall);      // 84
```

Three namespaces — every function takes `dir: string` as its first argument:

| Namespace | What it does |
|-----------|-------------|
| `api.read` | Inspect pages, templates, data, config, fitness — no side effects |
| `api.write` | Create, update, or delete content, templates, data, assets |
| `api.build` | Scaffold, build, preview, serve, clean |

See [docs/HUMAN.md](docs/HUMAN.md) for the full API reference.

---

## LLM integration

For agent builders wiring the library into an LLM harness:

```ts
import { tools, skills, soul } from '@ghostpaw/website';

// Inject into system prompt
const systemPrompt = soul.siteBuilderPersona.renderSoulPromptFoundation();

// Register with your harness
const toolDefs = tools.TOOLS; // JSON Schema + call(dir, input) → ToolResult

// Inject into reasoning steps
const skill = skills.SKILLS.find(s => s.name === 'create-page-well');
```

Every tool returns a discriminated `ToolResult`:

```ts
{ status: 'success',             data: T }
{ status: 'no_op',               message: string }
{ status: 'needs_clarification', question: string }
{ status: 'error',               code: string, message: string }
```

The core agent loop:

```
site_read → site_plan → site_write → site_check → repeat
```

See [docs/LLM.md](docs/LLM.md) for the full agent-builder reference.

---

## Tools

| Tool | What it does |
|------|-------------|
| `site_read` | Inspect pages, templates, data, config, and fitness — no side effects |
| `site_write` | Create, update, or delete content, templates, data, and assets |
| `site_build` | Build, scaffold, preview, serve, or clean a site |
| `site_check` | Run the fitness system and return prioritised issues with fix suggestions |
| `site_plan` | Dry-run proposed changes and preview the fitness delta before writing |

---

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

---

## Fitness analyzers

| Tier | Analyzers |
|------|-----------|
| **Tier 1** — always runs | `seo_meta`, `seo_structure`, `content_quality`, `images`, `links`, `social`, `sitemap_robots`, `technical` |
| **Tier 2** — TF-IDF corpus | `cannibalization`, `topical_clusters`, `content_tfidf` |
| **Tier 3** — schema-aware | `schema_validation`, `geo`, `eeat`, `local_seo`, `multilingual`, `voice_compliance` |
| **Tier 4** — optional | `search_console` (requires GSC data) |

Score targets: **≥ 80** to publish, **≥ 90** for production excellence.

See [docs/entities/FITNESS.md](docs/entities/FITNESS.md) for the full analyzer reference.

---

## Key properties

- **Fitness-first.** Score and issues are first-class outputs. The HTML is the side effect.
- **Dual-use CLI.** `website` is equally usable by humans and agents — same commands, `--json` for machine output.
- **SKILL.md ships with every project.** Any agent with shell access can operate the site immediately.
- **LLM-native library.** Soul for posture, tools for actions, skills for workflow — designed for agentic use from day one.
- **Zero-config Schema.org.** `faq.html`, `breadcrumb.html`, and `table.html` auto-inject correct JSON-LD.
- **Dry-run before write.** `site_plan` simulates any mutation and returns a fitness delta before a file is touched.
- **Everything is files.** `content/`, `templates/`, `assets/`, `data/`, `site.json` — no database, no admin UI.
- **Production-safe server.** `website start` is hardened: traversal guard, dotfile protection, security headers, gzip, graceful shutdown.
- **Two runtime dependencies.** `marked` for Markdown rendering, `citty` for the CLI.

---

## Documentation

| Document | Audience |
|----------|---------|
| [docs/HUMAN.md](docs/HUMAN.md) | CLI usage and direct `api.read` / `api.write` / `api.build` reference |
| [docs/LLM.md](docs/LLM.md) | Agent integration: CLI via SKILL.md, and library `soul` / `tools` / `skills` |
| [docs/entities/CONTENT.md](docs/entities/CONTENT.md) | Pages, frontmatter schema, collections, URL routing |
| [docs/entities/TEMPLATES.md](docs/entities/TEMPLATES.md) | Templates, layouts, partials, auto-injected Schema.org |
| [docs/entities/FITNESS.md](docs/entities/FITNESS.md) | 19 fitness analyzers, scoring, issue format, history |

---

## Development

```bash
npm install
npm test            # node:test runner, no external framework
npm run typecheck   # tsc --noEmit
npm run lint        # biome check
npm run build       # ESM + CJS + declarations + CLI binary via tsup
```

### Support

If this package helps your project, consider sponsoring its maintenance:

[![GitHub Sponsors](https://img.shields.io/badge/Sponsor-EA4AAA?style=for-the-badge&logo=github&logoColor=white)](https://github.com/sponsors/Anonyfox)

---

Part of the [GhostPaw](https://github.com/GhostPawJS) ecosystem.

**[Anonyfox](https://anonyfox.com) • [MIT License](LICENSE)**
