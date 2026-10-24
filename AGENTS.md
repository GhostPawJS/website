# @ghostpaw/website

A file-based static site builder with content APIs, templates, and fitness checks.

## Use

Requires Node.js 24 or newer. Install with `npm install @ghostpaw/website`.

```ts
import { scaffold, buildSite, websiteTools } from '@ghostpaw/website';

await scaffold('./my-site', { name: 'Example', url: 'https://example.com' });
const result = await buildSite('./my-site');
console.log(result.pages.length);

const config = await websiteTools[0].handler('./my-site', { action: 'get_config' });
console.log(config.ok, config.outcome, config.summary, config.data);
```

The `website` CLI provides init, dev, build, check, new, config, deploy, and start.
Run `website --help` or `website <command> --help` for options.

Tools live in `src/tools/`. The additive registry exports `websiteTools`,
`listWebsiteToolDefinitions()`, and `getWebsiteToolByName(name)` (null if absent).
Definitions include JSON Schema, selection guidance, readOnly, sideEffects,
and a handler taking a project directory and input. Results contain
`{ ok, outcome, summary, next?, data? }`; errors also include code and message.
The deprecated `TOOLS` registry and individual tools retain their original
`call(dir, input)` methods and `{ status, data? }` result variants.

## Layout

- `src/api/`: read, write, and build namespaces.
- `src/build/`, `src/content/`, `src/project/`, `src/fs/`: build and file handling.
- `src/render/`, `src/template/`, `src/yaml/`: local rendering and parsing.
- `src/fitness/`: analyzer registry, scoring, and language kits.
- `src/tools/`: tool implementations and shared facade adapters.
- `src/cli/`: commands, argument parsing, and HTTP servers.
- `src/demo/`, `docs/`: browser demo and package documentation.

## Contribute

Use Node 24. Keep zero runtime dependencies: do not add dependencies, optional
runtime dependencies, or peers. Development dependencies support checks only;
marked is a test oracle and must never be imported by production code.

Run the full gate before submitting changes:

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run check:deps
```

Tests use `node:test` and `node:assert/strict` in `*.test.ts` beside source.
Test observable behavior, preserve existing assertions, and do not skip tests
or exclude source from coverage. Markdown changes must retain exact marked
parity for the checked-in corpus and supported GFM constructs.

Keep changes additive and non-breaking. Preserve exported names, signatures,
tool names and schemas, CLI flags and defaults, and synchronous behavior.
Add maintainer-facing changes to `CHANGELOG.md` under Unreleased.

Maintainers release with `npm run release:patch` or `npm run release:minor`.
These scripts version, tag, and push; CI publishes with provenance.
Do not run release commands while preparing a contribution.
