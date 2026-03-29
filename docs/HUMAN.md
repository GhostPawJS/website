# @ghostpaw/website — Developer Reference

For human operators and developers. Covers the CLI for day-to-day use and the programmatic `api` surface for those integrating the library directly. If you are wiring it into an LLM agent, read [LLM.md](LLM.md) instead.

---

## CLI

The `website` binary is the primary human interface. Install it once and use it from any project root.

### Requirements

Node.js 24+. No database, no framework, no config files beyond the site itself.

### Installation

```bash
# Zero-install for new projects:
npx @ghostpaw/website init my-site

# Or install locally in an existing project:
npm install @ghostpaw/website --save-dev
```

After `init`, `package.json` is written with these scripts ready to use:

```json
{
  "scripts": {
    "dev":   "website dev",
    "build": "website build",
    "check": "website check",
    "start": "website start"
  }
}
```

### Convention

**All commands except `init` must be run from the project root** — the directory containing `site.json`. This is the only path rule: if you are in the right directory, commands work; if not, you get a clear error and nothing happens.

**Never edit `dist/` directly.** It is overwritten on every build. Everything you care about lives in `content/`, `templates/`, `assets/`, `data/`, and `site.json`.

---

### `website init [dir]`

Scaffold a new site, run the first build, and write `package.json` scripts.

```bash
npx @ghostpaw/website init                          # init in current directory
npx @ghostpaw/website init my-site                  # create my-site/
npx @ghostpaw/website init my-site --name "Acme" --url https://acme.com --lang de
```

Flags: `--name`, `--url`, `--lang` (BCP 47), `--force` (allow re-init in existing project).

Creates: `site.json`, `DOMAIN.md`, `PERSONA.md`, `SKILL.md`, `content/`, `templates/`, `assets/`, `data/`, `package.json`.

---

### `website dev`

Start the development server. Watches source files and rebuilds automatically.

```bash
npm run dev
website dev --port 4000
```

On startup:

```
  Local:    http://localhost:3000
  Project:  Acme · 6 pages
  Fitness:  84/100 — 3 issues (run `website check`)

  Watching content/, templates/, data/, assets/
  Ctrl+C to stop
```

After each file save:

```
  12:34:01  rebuilt 28ms · 6 pages
```

Livereload via SSE — the browser refreshes automatically. Content file changes trigger an incremental rebuild (only the changed page). Template or `site.json` changes trigger a full rebuild.

---

### `website build`

Full production build.

```bash
npm run build
website build --threshold 80   # exit 1 if fitness below 80 (for CI)
website build --json           # emit raw BuildResult + FitnessReport as JSON
```

Steps:
1. Render all pages to `dist/`
2. Pre-compress every text asset as `.gz` alongside the original (for the production server)
3. Run the fitness system and print a summary
4. Exit 1 if `--threshold` is set and the score is below it

---

### `website check`

Run all 19 fitness analyzers and show a formatted report.

```bash
npm run check
website check --page /about/    # scope to one page (faster)
website check --json            # raw FitnessReport JSON (for piping or scripting)
```

Output:

```
  Fitness Report — Acme
  ────────────────────────────────────────────────────
  Overall  84/100

  Dimensions
  content_quality          68  ██████████████████░░░░░░  2 errors
  seo_meta                 82  ████████████████████░░░░  1 warning
  ...

  Issues  3 total — 2 errors · 1 warning

  ERROR  /blog/post/  content_quality
         Page has 180 words (recommended ≥ 1000 for "post" layout).
         Fix: add content to the page body
         → content/blog/post.md
```

Exits 1 if any error-severity issues are found — making it usable in CI pipelines (`npm run check && npm run deploy`).

---

### `website new page <slug>` / `website new post <slug>`

Create a new content file with correct frontmatter already filled in.

```bash
website new page about/team
website new post blog/rooftop-case-study --title "Rooftop Case Study"
```

Writes to `content/<slug>.md`. Will not overwrite an existing file. After creation, edit the file body and run `website check --page /<slug>/` to see the initial fitness score.

---

### `website config get [key]` / `website config set <key> <value>`

Read or update `site.json` using dot-notation keys.

```bash
website config get                              # print full site.json
website config get fitness.voice.bannedWords    # print one value
website config set url https://acme.com
website config set fitness.voice.burstinessMin 0.35
website config set fitness.thresholds.overall 85
```

`set` accepts any JSON-parseable value, or a plain string as fallback:

```bash
website config set fitness.voice.bannedWords '["delve","leverage","tapestry"]'
```

Always shows a before/after diff:

```
  site.json updated
  url:  "http://localhost:3000"  →  "https://acme.com"
```

---

### `website deploy [--provider]`

Generate deployment config files. No auth, no network calls.

```bash
website deploy --github-pages   # writes .github/workflows/pages.yml
website deploy --netlify         # writes netlify.toml with security headers
website deploy --cloudflare      # prints Cloudflare Pages dashboard instructions
website deploy --docker          # writes Dockerfile + .dockerignore
```

Running `website deploy` with no flags lists all options.

**GitHub Pages**: push to `main` and enable Pages in repo Settings → Pages → Source: GitHub Actions.

**Netlify**: connect your repo at app.netlify.com → Add new site.

**Cloudflare Pages**: build command `npm run build`, output directory `dist`, Node version `24`.

**Docker**: for self-hosting on a VPS or container platform. Move `@ghostpaw/website` to `dependencies` (not `devDependencies`) before building the image, since `website start` runs at runtime.

---

### `website start`

Production HTTP server serving `dist/`. No watch, no rebuild, no livereload.

```bash
npm run start
website start --port 8080 --log
PORT=8080 website start        # PORT env var (for containers, Render, Railway, Fly.io)
website start --trust-proxy    # when behind nginx/Caddy — reads X-Forwarded-For
website start --no-security-headers   # when proxy sets them upstream
```

Built-in guarantees:
- **Security headers** on every response: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `X-XSS-Protection: 0`, `Permissions-Policy`
- **Gzip** served from pre-compressed `.gz` files (zero runtime CPU cost; written by `website build`)
- **ETag** for conditional requests — browsers skip the download on repeat visits
- **Cache-Control**: `no-cache` for HTML (always fresh), `immutable` for content-hashed assets, `max-age=3600` for everything else
- **Clean URLs**: `/about` → `301` → `/about/` → serves `dist/about/index.html`
- **Path traversal guard**: any path that escapes `dist/` → 404
- **Dotfile protection**: requests for `.build-manifest.json` etc → 404
- **Graceful shutdown**: `SIGTERM`/`SIGINT` finish in-flight requests before exiting (container-safe)
- **Request timeout**: 30 seconds (configurable with `--timeout`)

Suitable for production use behind nginx, Caddy, or directly exposed on a VPS. For zero-ops deployments, use one of the static hosting providers via `website deploy`.

---

## File ownership

| File / directory | Who owns it | How to modify |
|---|---|---|
| `dist/` | Build pipeline | `website build` only — never edit directly |
| `site.json` | Operator | `website config set` |
| `content/*.md` | Human / agent | Edit directly (frontmatter + markdown body) |
| `templates/*.html` | Developer | Edit directly |
| `data/*.json` | Human / agent | Edit directly |
| `assets/` | Developer | Edit directly |
| `.build-manifest.json` | Build pipeline | Do not touch |
| `.fitness-history.json` | Fitness pipeline | Do not touch |
| `DOMAIN.md`, `PERSONA.md` | Operator | Edit directly |
| `SKILL.md` | Package (initial) | Customise as needed |

---

## Programmatic API

For developers integrating the library directly into Node.js code. All runtime functionality flows through three namespaces; every function takes `dir: string` as its first argument.

```bash
npm install @ghostpaw/website
```

```ts
import { api, buildSite, scaffold, SiteError, isSiteError } from '@ghostpaw/website';
```

---

### api.read

All functions are async. None have side effects.

#### Pages

```ts
api.read.listPages(dir, filter?)     // → PageSummary[]
api.read.getPage(dir, path)          // → PageDetail  (includes rendered HTML)
```

`filter` accepts `{ collection?, url? }`. `url` is matched as a prefix.

`PageSummary` shape:

```ts
{
  path: string,           // relative path, e.g. "content/blog/post.md"
  url: string,
  collection: string | null,
  frontmatter: PageFrontmatter,
  wordCount: number,
  readability: ReadabilityScores,
}
```

#### Templates

```ts
api.read.listTemplates(dir)          // → TemplateSummary[]
api.read.getTemplate(dir, name)      // → string  (raw HTML source)
```

#### Assets

```ts
api.read.listAssets(dir, filter?)    // → AssetSummary[]
api.read.getAsset(dir, path)         // → AssetDetail
```

#### Data

```ts
api.read.listData(dir)               // → DataSummary[]
api.read.getData(dir, name)          // → unknown  (parsed JSON)
```

`name` is the bare filename without `.json` extension.

#### Site config and identity

```ts
api.read.getConfig(dir)              // → SiteConfig
api.read.getDomain(dir)              // → string  (DOMAIN.md content)
api.read.getPersona(dir)             // → string  (PERSONA.md content)
api.read.getStructure(dir)           // → SiteStructure
```

#### Fitness

```ts
api.read.fitness(dir, opts?)         // → FitnessReport
api.read.fitnessPage(dir, path)      // → PageScore
api.read.fitnessHistory(dir)         // → FitnessHistoryEntry[]
```

`opts` accepts `{ dimensions?: string[], searchConsole?: GscData }`.

`FitnessReport` shape:

```ts
{
  overall: number,
  timestamp: number,
  dimensions: Record<string, DimensionScore>,
  pages: Record<string, PageScore>,
  clusters: TopicalCluster[],
  cannibalization: CannibalizationPair[],
}
```

Each `Issue` carries:

| Field | Type | Notes |
|-------|------|-------|
| `severity` | `'error' \| 'warning' \| 'info'` | Errors block launch |
| `dimension` | `string` | Analyzer that raised the issue |
| `code` | `string` | Stable machine-readable identifier |
| `message` | `string` | Human-readable description |
| `page` | `string` | Affected page URL |
| `fix` | `{ file, action, field? }` | Actionable pointer to the exact change needed |

---

### api.write

All functions are async and mutate disk. All are idempotent — calling the same write twice produces the same result. Parent directories are created automatically.

```ts
// Pages
api.write.writePage(dir, path, frontmatter, markdown)
api.write.patchPage(dir, path, frontmatterPatch)   // update fields without touching body
api.write.deletePage(dir, path)

// Templates
api.write.writeTemplate(dir, name, html)
api.write.deleteTemplate(dir, name)

// Assets
api.write.writeAsset(dir, path, content)           // path relative to assets/
api.write.deleteAsset(dir, path)

// Data
api.write.writeData(dir, name, json)               // name without .json extension
api.write.deleteData(dir, name)

// Site config and identity
api.write.writeConfig(dir, partial)                // merges partial into site.json
api.write.writeDomain(dir, content)
api.write.writePersona(dir, content)
```

---

### api.build

```ts
// Build
api.build.build(dir, opts?)
// → BuildResult: { pages, skipped, manifest, fitness: null, duration }
// opts: { incremental?: boolean, skipClean?: boolean }

// Scaffold
api.build.scaffold(dir, opts?)
// opts: { name?, url?, language? }

// Dev server
api.build.preview(dir, path)         // → RenderedPage  (no dist/ write)
api.build.serve(dir, opts?)          // → ServeInstance  (livereload dev server)
api.build.stop(dir)                  // stop the dev server

// Utility
api.build.clean(dir)                 // delete dist/
```

`serve` options:

```ts
{
  port?: number,
  host?: string,
  livereload?: boolean,
  skipInitialBuild?: boolean,
  onRebuild?: (result: BuildResult) => void,
  onError?: (err: Error) => void,
}
```

---

### Error handling

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

All `api.read` functions throw `SiteError` on missing resources. All `api.write` functions create missing parent directories automatically.

---

### Typical programmatic workflow

```ts
import { scaffold, buildSite, api } from '@ghostpaw/website';

const dir = './my-site';

// 1. Bootstrap
await scaffold(dir, { name: 'Acme', url: 'https://acme.com' });

// 2. Add content
await api.write.writePage(dir, 'blog/hello.md', {
  title: 'Hello World',
  layout: 'post.html',
  datePublished: '2025-01-15',
}, '## Hello World\n\nFirst post.\n');

// 3. Build
const result = await buildSite(dir);
console.log(`${result.pages.length} pages in ${result.duration}ms`);

// 4. Check fitness
const report = await api.read.fitness(dir);
for (const issue of Object.values(report.dimensions).flatMap(d => d.issues)) {
  if (issue.severity === 'error') {
    console.error(`${issue.page}: ${issue.message}`);
    // issue.fix.file + issue.fix.action tell you exactly what to change
  }
}

// 5. Dev server (optional)
const instance = await api.build.serve(dir, { port: 3000 });
console.log(`Serving at ${instance.url}`);
```
