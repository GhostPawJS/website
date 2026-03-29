# @ghostpaw/website — Agent Integration Reference

This document is for agent builders. Two integration paths are available — use either or both:

| Path | When to use |
|------|-------------|
| **CLI via SKILL.md** | Agent already has shell access (Claude Code, Cursor, etc.). Fastest to wire up. |
| **Library tools/skills/soul** | Building a custom harness (OpenAI function calling, LangChain, MCP server, etc.). Full control. |

For the direct `api.read` / `api.write` / `api.build` surface used in code, see [HUMAN.md](HUMAN.md).

---

## Path 1 — CLI as agent interface

Every `@ghostpaw/website` project ships with a `SKILL.md` at the project root. This file is the complete agent skill: command reference, `--json` output shapes, file ownership rules, the agentic loop, and fitness score targets — all in ~600 tokens.

Any agent with shell access and file-read capability can operate a site immediately by reading `SKILL.md` once.

### How it works

```bash
website check --json        # → FitnessReport (raw JSON)
website build               # → build + pre-compress + fitness summary
website new post blog/slug  # → create content/blog/slug.md with frontmatter
website config set url https://acme.com
```

The `--json` flag on `check` and `build` returns structured data suitable for feeding directly into an LLM context or piping through `jq`.

### The agent loop over the CLI

```
website check --json
→ parse FitnessReport, identify errors and fix pointers
→ edit content/*.md directly, or call website new / website config set
website build
website check --json
→ verify score improved
→ repeat until overall ≥ target
```

### Setting it up

In Claude Code or any agent that reads a `CLAUDE.md` / `AGENT.md`:

```markdown
# Site management

This project uses @ghostpaw/website. Read SKILL.md for the full CLI reference.
All commands run from the project root (where site.json lives).
```

Or inject `SKILL.md` content directly into the system prompt:

```ts
import { readFile } from 'node:fs/promises';
const skill = await readFile('SKILL.md', 'utf8');
// Prepend to system prompt
```

### When to use this path

- Agent already has shell + file access (no extra wiring needed)
- You want the agent to work on an existing site without library integration
- You want human-readable terminal output alongside machine-readable `--json`
- You need the integration to work across multiple LLM providers without changing code

---

## Path 2 — Library tools, skills, and soul

For custom harnesses where you control the LLM integration layer.

## Runtime stack

```
soul     →  thinking foundation injected into the system prompt
tools    →  intent-shaped actions with JSON Schema inputs and structured results
skills   →  reusable workflow playbooks injected as markdown into reasoning steps
```

All three layers are optional and additive. They do not add new capabilities beyond what `api.read` / `api.write` / `api.build` expose — they structure how an LLM reasons about and calls the existing surface.

---

## Soul layer

```ts
import { soul } from '@ghostpaw/website';

const foundation = soul.siteBuilderPersona.renderSoulPromptFoundation();
// Inject at the top of your system prompt.
```

`soul.siteBuilderPersona` shape:

| Property | Type | Notes |
|----------|------|-------|
| `slug` | `string` | `'site-builder'` |
| `name` | `string` | `'Site Builder'` |
| `description` | `string` | One-line summary |
| `essence` | `string` | Extended thinking foundation |
| `traits` | `string[]` | 15 behavioural operating principles |
| `renderSoulPromptFoundation()` | `() => string` | Renders the full soul block for injection |

### What the soul establishes

The Site Builder soul is a fitness-driven web publishing specialist. It establishes five operating boundaries:

1. **Read before writing.** `site_read` precedes any `site_write` call. Never invent current state.
2. **Simulate before applying.** `site_plan` precedes non-trivial writes. Never guess at fitness impact.
3. **Batch, then check.** Group related writes, run `site_check` once at the end. Not after every field.
4. **Fix in priority order.** Errors before warnings, warnings before info. The severity field is authoritative.
5. **Prefer editing over creating.** New pages risk cannibalization. Extend existing pages first.

Additional operating principles embedded in traits: AI slop word avoidance, interrogative heading requirements, voice consistency via `PERSONA.md`, before/after score reporting, GSC data always forwarded when available.

---

## Tools layer

```ts
import { tools } from '@ghostpaw/website';

const { TOOLS, siteRead, siteWrite, siteBuild, siteCheck, sitePlan } = tools;
// TOOLS — full array, pass to your LLM harness as function definitions
// Each tool: { name, description, whenToUse, whenNotToUse, inputSchema, sideEffects, call }
// tool.call(dir, input) → Promise<ToolResult<T>>
```

Every tool exports `inputSchema` as a ready-to-use JSON Schema object. `sideEffects` is correctly set so harnesses can warn before mutations.

### ToolResult discriminated union

```ts
{ status: 'success',             data: T }
{ status: 'no_op',               message: string }
{ status: 'needs_clarification', question: string }
{ status: 'error',               code: string, message: string }
```

`needs_clarification` is returned — not `error` — when a required field is absent but the action is otherwise valid. The `question` field tells the LLM exactly what to provide next.

### Resilience guarantees

- `get_page`, `get_template`, `get_asset`, `get_data`, `fitness_page` — all return `needs_clarification` when `path` is missing, with a message pointing to the correct list action.
- `get_page` accepts `page:` and `url:` as aliases for `path:` — common LLM mis-spellings are resolved silently.
- `get_data` strips a `.json` extension from `path` automatically — `path: "nav.json"` and `path: "nav"` produce the same result.

### The 5 tools

#### `site_read` — read-only, no side effects

Inspect any part of the site. One tool for all read operations; dispatches on `action`.

Key input fields:

| Field | Notes |
|-------|-------|
| `action` | `list_pages \| get_page \| list_templates \| get_template \| list_assets \| get_asset \| list_data \| get_data \| get_config \| get_domain \| get_persona \| get_structure \| fitness \| fitness_page \| fitness_history` |
| `path` | Required for `get_page`, `get_template`, `get_asset`, `get_data`, `fitness_page` |
| `pageFilter` | `{ tag?, template?, slug? }` — used with `list_pages` |
| `dimensions` | `string[]` — limit fitness report to named dimensions |

Start every session with `site_read` + `action: "get_structure"` to understand the site topology, then `action: "fitness"` to understand the current state.

#### `site_write` — mutates disk

Create, update, or delete content, templates, data, and assets.

Key input fields:

| Field | Notes |
|-------|-------|
| `action` | `write_page \| delete_page \| patch_frontmatter \| write_template \| delete_template \| write_asset \| delete_asset \| write_data \| delete_data \| write_config \| write_domain \| write_persona` |
| `path` | Target path (required for most actions) |
| `frontmatter` | Page frontmatter object — for `write_page` and `patch_frontmatter` |
| `content` | Markdown body — for `write_page` |
| `json` | Parsed data — for `write_data` |
| `config` | Partial config object — for `write_config` |

`patch_frontmatter` updates individual frontmatter fields without touching the page body. Prefer it over `write_page` for targeted fixes.

#### `site_build` — runs the build pipeline

Build, scaffold, preview, or serve.

Key input fields:

| Field | Notes |
|-------|-------|
| `action` | `build \| scaffold \| preview \| serve \| stop \| clean` |
| `path` | Page path — required for `preview` |
| `config` | `{ name?, url?, language? }` — used with `scaffold` |
| `port` | Port for `serve` |

`build` returns `{ pageCount, duration }`. Do not run a full build to verify a single-page change — use `site_check` with a `page` filter instead.

#### `site_check` — fitness report, no side effects

Run the full fitness system and return a condensed summary.

Key input fields:

| Field | Notes |
|-------|-------|
| `page` | Optional — single-page path for a targeted check |
| `dimensions` | `string[]` — limit to specific dimensions |
| `searchConsole` | `GscData` — when available, always pass it; performance data outranks static analysis |

Returns `CheckSummary`:

```ts
{
  overallScore: number,
  topIssues: Issue[],           // up to 20, sorted by severity
  dimensionScores: Record<string, number>,
  weakestPages: PageScore[],    // up to 5
}
```

#### `site_plan` — dry-run, no side effects

Simulate proposed changes and preview the fitness delta before writing anything.

Key input fields:

| Field | Notes |
|-------|-------|
| `changes` | `DryRunChange[]` — array of proposed mutations |

Returns `PlanSummary`:

```ts
{
  overallDelta: number,
  scoreBefore: number,
  scoreAfter: number,
  pageDeltas: Record<string, number>,
  newCannibalization: CannibalizationPair[],
  resolvedCannibalization: CannibalizationPair[],
  recommendation: string,
}
```

Use `site_plan` before any `write_page` that creates new content. A positive `overallDelta` means the change improves the site — proceed. A negative delta means it hurts — reconsider.

---

## Skills layer

```ts
import { skills } from '@ghostpaw/website';

const { SKILLS } = skills;
// Each skill: { name, description, whenToUse, content }
// Inject skill.content into system prompts or reasoning steps.
```

Skills are plain markdown strings. They teach sequencing — which tools to call, in what order, with what inputs, and how to interpret the results. Inject `skill.content` when you need the agent to follow a specific workflow.

### The 7 skills

| Name | What it covers |
|------|---------------|
| `create-page-well` | Frontmatter checklist, content structure, voice requirements, fitness targets |
| `seo-checklist` | Issue code reference, systematic fix loop, when to rebuild vs. recheck |
| `geo-optimization` | AI crawler allowances, interrogative headings, citation patterns, freshness signals |
| `template-composition` | Building-block templates, data files, Handlebars syntax, Schema.org auto-injection |
| `site-launch-checklist` | Per-dimension score targets, pre-launch verification steps |
| `content-cannibalization` | Similarity bands, merge / differentiate / canonicalise strategies |
| `search-console-workflow` | `GscData` shape, issue types (`low_ctr`, `keyword_opportunity`, `content_gap`, `url_flickering`), weekly loop |

---

## Core agent workflow

```
site_read   →  understand current state (structure + fitness)
site_plan   →  simulate proposed changes, preview fitness delta
site_write  →  apply confirmed changes
site_check  →  verify fitness improvement
              repeat until overallScore ≥ target
```

Target thresholds: **≥ 80** for launch, **≥ 90** for production excellence.

---

## Complete agent setup

```ts
import { tools, skills, soul } from '@ghostpaw/website';

const systemPrompt = [
  soul.siteBuilderPersona.renderSoulPromptFoundation(),
  // Inject relevant skills when the task calls for it:
  skills.SKILLS.find(s => s.name === 'create-page-well')?.content,
].filter(Boolean).join('\n\n---\n\n');

// Register with your LLM harness:
const toolDefs = tools.TOOLS;
// tool.inputSchema → JSON Schema for function-calling
// tool.call(dir, input) → Promise<ToolResult<T>>
```

---

## Design boundary

`soul`, `tools`, and `skills` are additive over the same `api.read` / `api.write` / `api.build` surface that human code uses. They do not add new capabilities. They exist solely to structure LLM reasoning and reduce the surface of plausible mistakes.
