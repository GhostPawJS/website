import type { Skill } from './types.ts';

export const seoChecklist: Skill = {
	name: 'seo-checklist',
	description: 'SEO patterns the fitness system validates, with examples and fix actions.',
	whenToUse:
		'When resolving seo_meta or seo_structure fitness issues, or doing a pre-launch SEO audit.',
	content: `# SEO Checklist

## Meta layer (seo_meta dimension)

| Check | Target | fitness code |
|---|---|---|
| Title length | 10–60 chars | \`title_too_short\`, \`title_too_long\` |
| Description length | 70–165 chars | \`desc_missing\`, \`description_too_short\`, \`description_too_long\` |
| Unique titles | No duplicates across site | \`duplicate_title\` |
| Unique descriptions | No duplicates | \`duplicate_description\` |
| Canonical present | Every page has a \`<link rel="canonical">\` | \`canonical_missing\` |
| Canonical self-referential | Canonical points to the page itself (unless intentional redirect) | \`canonical_mismatch\` |
| OG title | \`og:title\` present | \`og_title_missing\` |
| OG description | \`og:description\` present | \`og_desc_missing\` |
| OG image | \`og:image\` present with absolute URL | \`og_image_missing\` |

## Structure layer (seo_structure dimension)

| Check | Rule | fitness code |
|---|---|---|
| Single H1 | One H1 per page, not zero, not two | \`h1_missing\`, \`multiple_h1\` |
| Heading hierarchy | No skipped levels (H1→H2→H3) | \`heading_hierarchy\` |
| Keyword in H1 | Primary topic in the main heading | \`h1_keyword\` |
| Internal links | At least 1 internal link on non-index pages | \`no_internal_links\` |
| Descriptive anchors | Link text is not "click here" or "read more" | \`generic_anchor_text\` |
| Broken internal links | All href targets resolve to known pages | \`broken_internal_link\` |

## Schema (schema_validation dimension)

Use the building-block templates — they emit correct JSON-LD automatically:
- \`faq.html\` → FAQPage schema
- \`breadcrumb.html\` → BreadcrumbList schema

For article/blog pages add to frontmatter:
\`\`\`yaml
datePublished: "2024-01-15"
dateModified:  "2024-03-10"
og_image:      "/images/article-hero.jpg"
\`\`\`

## Fix workflow

1. Run \`site_check\` with \`dimensions: ["seo_meta", "seo_structure"]\`.
2. Sort issues by severity (errors first).
3. For each error: use the \`fix\` field — it specifies \`file\`, \`action\` (set_frontmatter / update_content), and \`field\`.
4. Apply with \`site_write\`.
5. Re-run \`site_check\` to confirm resolution.
`,
};
