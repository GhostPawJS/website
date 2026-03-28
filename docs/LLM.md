# @ghostpaw/website — Agent Builder Reference

This document is for agent builders wiring `soul`, `tools`, and `skills` into
an LLM harness. For the low-level `api.read` / `api.write` / `api.build`
surface, see [HUMAN.md](HUMAN.md).

## Runtime stack

```
soul     →  thinking foundation for the system prompt
tools    →  intent-shaped actions with JSON Schema inputs
skills   →  reusable workflow playbooks as markdown strings
```

All layers are optional and additive. No layer adds capabilities beyond what
the human API exposes — they structure how an LLM reasons about and calls the
existing API.

---

## Soul layer

```ts
import { soul } from '@ghostpaw/website';

const foundation = soul.siteBuilderPersona.renderSoulPromptFoundation();
// Inject at the top of your system prompt.
```

`soul.siteBuilderPersona` exposes:

| Property | Type | Notes |
|----------|------|-------|
| `slug` | `string` | Machine identifier |
| `name` | `string` | Display name |
| `description` | `string` | One-line summary |
| `essence` | `string` | Extended thinking foundation |
| `traits` | `array` | Behavioural principles |
| `renderSoulPromptFoundation()` | `() => string` | Renders the full soul block for injection |

---

## Tools layer

```ts
import { tools } from '@ghostpaw/website';

const { TOOLS, siteRead, siteWrite, siteBuild, siteCheck, sitePlan } = tools;
// TOOLS is the full array — pass it to your LLM harness as function definitions.
// Each tool: { name, description, whenToUse, whenNotToUse, inputSchema, sideEffects, call }
// call(dir, input) → Promise<ToolResult<T>>
```

Every tool exports `inputSchema` as a ready-to-use JSON Schema object.
`sideEffects` is correctly flagged so harnesses can warn before mutations.

### ToolResult discriminated union

```ts
{ status: 'success', data: T }
{ status: 'no_op', message: string }
{ status: 'needs_clarification', question: string }
{ status: 'error', code: string, message: string }
```

### The 5 tools

#### `site_read` — `siteRead`

Read anything from the site without side effects.

Key input fields:

| Field | Notes |
|-------|-------|
| `action` | `list_pages \| get_page \| list_templates \| get_template \| list_assets \| get_asset \| list_data \| get_data \| get_config \| get_domain \| get_persona \| get_structure \| fitness \| fitness_page \| fitness_history` |
| `path` | Page or asset path (required for `get_page`, `get_asset`, `fitness_page`) |
| `pageFilter` | `{ tag?, template?, slug? }` |
| `assetFilter` | Filter object for `list_assets` |
| `dimensions` | `string[]` — limit fitness analysis to specific dimensions |

#### `site_write` — `siteWrite`

Mutate site content. Has side effects.

Key input fields:

| Field | Notes |
|-------|-------|
| `action` | `write_page \| delete_page \| write_template \| delete_template \| write_asset \| delete_asset \| write_data \| delete_data \| write_config \| write_domain \| write_persona` |
| `path` | Target path |
| `frontmatter` | Page frontmatter object (for `write_page`) |
| `content` | Markdown or HTML body |
| `json` | Parsed data (for `write_data`) |
| `config` | Partial config object (for `write_config`) |

#### `site_build` — `siteBuild`

Build, scaffold, preview, or serve the site. Has side effects.

Key input fields:

| Field | Notes |
|-------|-------|
| `action` | `build \| preview \| serve \| stop \| clean \| scaffold` |
| `path` | Page path (required for `preview`) |
| `buildOptions` | Options forwarded to the build step |
| `port` | Port for `serve` |
| `scaffoldOptions` | `{ name?, url?, language? }` |

#### `site_check` — `siteCheck`

Run a fitness check and return a condensed summary. No side effects.

Key input fields:

| Field | Notes |
|-------|-------|
| `page` | Optional — single-page path for a targeted check |
| `dimensions` | `string[]` — limit to specific dimensions |
| `searchConsole` | Search Console data to incorporate |

Returns `CheckSummary`:

```ts
{
  overallScore: number,
  topIssues: Issue[],          // up to 20
  dimensionScores: Record<string, number>,
  weakestPages: PageScore[]    // up to 5
}
```

#### `site_plan` — `sitePlan`

Simulate proposed changes and preview the fitness delta before writing anything.
No side effects.

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
  recommendation: string
}
```

---

## Skills layer

```ts
import { skills } from '@ghostpaw/website';

const { SKILLS } = skills;
// Each skill: { name, description, whenToUse, content }
// Inject skill.content into your system prompt or reasoning step.
```

Skills are plain markdown strings. Inject `skill.content` wherever you need
the agent to follow a specific workflow.

### The 7 skills

| Name | What it covers |
|------|---------------|
| `create-page-well` | Frontmatter checklist, content structure, voice rules |
| `seo-checklist` | Fitness issue codes, fix workflow |
| `geo-optimization` | AI crawlers, interrogative headings, citations, freshness signals |
| `template-composition` | Building-block templates, data files, mustache syntax |
| `site-launch-checklist` | Per-dimension score targets, pre-launch steps |
| `content-cannibalization` | Similarity bands, merge / differentiate / canonicalise strategies |
| `search-console-workflow` | GscData shape, issue types (`low_ctr`, `keyword_opportunity`, `content_gap`, `url_flickering`), weekly workflow |

---

## Core LLM workflow

```
site_read   →  understand current state
site_plan   →  simulate proposed changes, preview fitness delta
site_write  →  apply confirmed changes
site_check  →  verify fitness improvement
              repeat until overall score >= target
```

---

## Complete agent setup

```ts
import { tools, skills, soul } from '@ghostpaw/website';

const systemPrompt = [
  soul.siteBuilderPersona.renderSoulPromptFoundation(),
  // Inject relevant skills as needed:
  skills.SKILLS.find(s => s.name === 'create-page-well')?.content,
].join('\n\n');

// Register tools with your LLM harness:
const toolRegistry = tools.TOOLS;
// Each tool.inputSchema is a JSON Schema object ready for function-calling.
```

---

## Design boundary

`soul`, `tools`, and `skills` are additive over the same `api.read` /
`api.write` / `api.build` surface that human code uses. They do not add new
capabilities. They exist solely to structure LLM reasoning.
