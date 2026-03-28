import type { Skill } from './types.ts';

export const searchConsoleWorkflow: Skill = {
	name: 'search-console-workflow',
	description: 'How to ingest GSC / Bing Webmaster data and act on the search_console analysis.',
	whenToUse:
		'When integrating Google Search Console or Bing Webmaster data with the fitness system.',
	content: `# Search Console Workflow

## Data shape

The fitness system expects GSC data as a \`GscData\` object:

\`\`\`typescript
interface GscData {
  rows: GscRow[];
  period?: string; // e.g. "2024-01-01 to 2024-03-31"
}

interface GscRow {
  page:        string;  // full URL, e.g. "https://example.com/blog/post/"
  query:       string;  // search query
  clicks:      number;
  impressions: number;
  ctr:         number;  // 0–1 decimal
  position:    number;  // average ranking position
  date?:       string;  // optional ISO date
}
\`\`\`

## Exporting from Google Search Console

1. Open GSC → Performance → Search results.
2. Set date range (90 days recommended).
3. Export → Download CSV (Google Sheets format).
4. Transform to the GscRow shape (one row per page+query combination).

If your GSC export is per-page without query breakdown, set \`query: ""\` — the system will still run page-level checks.

## Running the analysis

\`\`\`
site_check: {
  searchConsole: {
    rows: [ ...your rows... ],
    period: "2024-01-01 to 2024-03-31"
  }
}
\`\`\`

## Issue types

### \`low_ctr\`
**Meaning**: The page ranks (position ≤ 10) but click-through rate is below what's expected for that position.

Expected CTR benchmarks:
| Position | Expected CTR |
|---|---|
| 1 | 28% |
| 2 | 15% |
| 3–5 | 8–10% |
| 6–10 | 3–5% |

**Fix**: Rewrite the title and meta description to be more compelling. Run \`site_plan\` first.

### \`keyword_opportunity\`
**Meaning**: A query gets 200+ impressions, positions 4–10, but the site has no page specifically targeting it.

**Fix**: Create a new page with the query as the primary keyword. Use the \`create-page-well\` skill.

### \`content_gap\`
**Meaning**: A query gets 50+ impressions but no existing page matches the query text.

**Fix**: Identify which existing page should cover this topic, expand it, or create a new page.

### \`url_flickering\`
**Meaning**: Two or more pages appear for the same query with significant impressions each. Search engines are alternating between them.

**Fix**: This is a cannibalization symptom. Use the \`content-cannibalization\` skill to consolidate or differentiate.

## Weekly workflow

1. Export GSC data (last 28 days minimum).
2. Run \`site_check\` with the GSC data.
3. Prioritise: low_ctr errors → keyword_opportunities → content_gaps → flickering.
4. For each \`low_ctr\`: use \`site_plan\` with an updated title/description, verify score improves, then \`site_write\`.
5. For each \`keyword_opportunity\`: create a targeted page with \`site_write\`.
6. Rebuild with \`site_build\`.
7. Repeat next week with fresh data to track progress.
`,
};
