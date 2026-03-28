# @ghostpaw/website — Documentation

The source of truth for the runtime surface lives in code under `src/`. These docs describe what each concept is for, why it exists, and which public APIs belong to it.

## Guides

| Document | Audience |
|----------|---------|
| [HUMAN.md](HUMAN.md) | Human developers using `api.read` / `api.write` / `api.build` directly |
| [LLM.md](LLM.md) | Agent builders wiring `soul`, `tools`, and `skills` into an LLM harness |

## Entity reference

| Document | What it covers |
|----------|---------------|
| [entities/CONTENT.md](entities/CONTENT.md) | Pages: frontmatter schema, collections, URL routing, `_index` pages |
| [entities/TEMPLATES.md](entities/TEMPLATES.md) | Templates: Handlebars syntax, layouts, partials, building blocks, auto-injected Schema.org |
| [entities/FITNESS.md](entities/FITNESS.md) | Fitness system: 19 analyzers, tier structure, scoring, issue format, history |

## Design reference

| Document | What it covers |
|----------|---------------|
| [CONCEPT.md](CONCEPT.md) | Full system design: content model, build pipeline, fitness architecture, API surface, language kits |
