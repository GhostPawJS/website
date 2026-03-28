import type { Skill } from './types.ts';

export const contentCannibalization: Skill = {
	name: 'content-cannibalization',
	description: 'How to interpret cannibalization similarity scores and resolve overlapping pages.',
	whenToUse:
		'When site_check reports cannibalization issues or when auditing content for keyword overlap.',
	content: `# Content Cannibalization

## What is cannibalization?

Cannibalization happens when two or more pages target the same keywords, splitting ranking signals and confusing search engines about which page to serve for a query.

The fitness system detects it via TF-IDF cosine similarity. Pairs with similarity > 0.7 are flagged.

## Reading the report

\`\`\`
site_check: { dimensions: ["cannibalization"] }
\`\`\`

Each \`cannibalization\` issue includes:
- **pageA / pageB**: the two conflicting URLs
- **similarity**: 0–1 score (higher = more overlap)
- **sharedTerms**: the TF-IDF terms driving the overlap

Similarity bands:
| Score | Meaning |
|---|---|
| 0.7–0.8 | Significant overlap — monitor or differentiate |
| 0.8–0.9 | High overlap — one page should be consolidated |
| 0.9–1.0 | Near-duplicate — merge immediately |

## Resolution strategies

### 1. Consolidate (merge two pages into one)
Use when both pages cover essentially the same topic at the same depth.

\`\`\`
1. site_read: { action: "get_page", path: "/page-a/" }
2. site_read: { action: "get_page", path: "/page-b/" }
3. Combine the best content into page-a
4. site_write: { action: "write_page", path: "page-a.md", ... }
5. site_write: { action: "delete_page", path: "page-b.md" }
   (add a redirect in assets/robots.txt or via a canonical on page-b pointing to page-a)
\`\`\`

### 2. Differentiate (make each page clearly distinct)
Use when both pages serve legitimately different intents (informational vs transactional).

- Rewrite page-a to focus on the informational angle.
- Rewrite page-b to focus on the transactional/commercial angle.
- Add cross-links: "For buying options, see [Page B]."
- Avoid using the same H1/title keywords on both.

### 3. Canonicalise (point duplicate to the authoritative version)
Use when one page is a filter/tag page that duplicates another.

In the weaker page's frontmatter:
\`\`\`yaml
canonical: "https://example.com/authoritative-page/"
\`\`\`

### 4. Scope with \`noindex\`
Use only as a last resort for internal-use pages.

In the page's template, add to \`<head>\`:
\`\`\`html
<meta name="robots" content="noindex, follow">
\`\`\`

## Verification

After resolving, run \`site_plan\` with the delete/update changes to confirm similarity drops before committing:

\`\`\`
site_plan: { changes: [ { kind: "delete_page", path: "page-b.md" } ] }
\`\`\`

Confirm \`resolvedCannibalization\` includes the pair, then apply with \`site_write\`.
`,
};
