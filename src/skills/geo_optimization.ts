import type { Skill } from './types.ts';

export const geoOptimization: Skill = {
	name: 'geo-optimization',
	description: 'GEO patterns for AI search visibility, citation markup, and structured answers.',
	whenToUse:
		'When resolving geo fitness issues or optimising content for AI-powered search engines (ChatGPT, Perplexity, Claude).',
	content: `# GEO Optimization

GEO = Generative Engine Optimization. AI search engines cite pages that provide clear, structured answers.

## Allow AI crawlers

In \`assets/robots.txt\` — do NOT block AI bots unless you have a specific reason:

\`\`\`
# Allow all crawlers by default
User-agent: *
Allow: /

# Explicitly allow AI search crawlers
User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: PerplexityBot
Allow: /
\`\`\`

The fitness system flags \`Disallow: /\` rules for named AI bots as a \`ai_bot_blocked\` error.

## Write interrogative headings

AI engines prefer direct-answer content. Use question-form headings:

\`\`\`markdown
## How does X work?
X works by ...

## What is the difference between A and B?
A focuses on ..., while B focuses on ...

## When should you use Y?
Use Y when ...
\`\`\`

The fitness system checks for a \`?\` in heading text. Missing interrogatives = \`no_interrogative_heading\` info issue.

## Cite sources with blockquotes

When referencing external facts or studies, use blockquotes with attribution:

\`\`\`markdown
> "Quote from a study or authoritative source."
> — Source Name, Year
\`\`\`

Cited content signals factual grounding to AI engines. The fitness system checks for \`<blockquote>\` presence.

## Content freshness

Add \`dateModified\` to frontmatter and include an "Updated" line in the content for time-sensitive pages:

\`\`\`yaml
dateModified: "2024-03-10"
\`\`\`

\`\`\`markdown
*Updated March 2024 with current pricing data.*
\`\`\`

## Entity richness

Name real people, places, organisations, and products. AI engines use entity density to assess authority:

- Name the author in the content or via Person JSON-LD.
- Reference specific products, standards, or organisations by full name on first use.
- Avoid vague language like "a company" or "some researchers" — be specific.

## Fix workflow

1. Run \`site_check\` with \`dimensions: ["geo"]\`.
2. Check for \`ai_bot_blocked\` errors first — fix robots.txt.
3. Add question headings to pages with \`no_interrogative_heading\`.
4. Add blockquotes with attribution to factual pages.
5. Add \`dateModified\` to frontmatter for recently-updated content.
`,
};
