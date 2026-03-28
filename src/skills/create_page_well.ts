import type { Skill } from './types.ts';

export const createPageWell: Skill = {
	name: 'create-page-well',
	description:
		'How to write good frontmatter and content that passes fitness checks from the start.',
	whenToUse: 'When creating a new page or reviewing a draft before writing it to disk.',
	content: `# Create a Page Well

## Frontmatter checklist

Every page must have:

\`\`\`yaml
title: "60 chars max — include the primary keyword near the front"
description: "70–165 chars — compelling summary that also works as a meta description"
layout: page.html       # or post.html, faq.html, etc. — match intent
\`\`\`

Optional but high-value:

\`\`\`yaml
datePublished: "2024-01-15"     # ISO date — enables freshness signals
dateModified:  "2024-03-10"     # update when content changes significantly
og_image:      "/images/og-hero.jpg"  # 1200×630 for Open Graph (image: also accepted)
tags:          [seo, content, web]    # 2–5 topical tags
canonical:     "https://example.com/page/"  # only when needed
\`\`\`

## Title rules
- Primary keyword first, or near first.
- Keep under 60 characters (including spaces).
- Each page title must be unique across the site.
- No clickbait — match what the content delivers.

## Description rules
- 70–165 characters (aim for 120–155 for best display in SERPs).
- Include the primary keyword naturally.
- Write as a benefit statement, not just a label.
- No duplicate descriptions across pages.

## Content structure
- Open with the answer or key point (inverted pyramid).
- Use one H1 — the page template normally renders title as H1, so start with H2 inside content.
- Use H2 for major sections, H3 for sub-sections. Never skip levels.
- Include at least one interrogative heading ("How does X work?") for direct-answer eligibility.
- Aim for 300+ words for informational pages; 150+ words minimum.
- Link to 2–3 related internal pages using descriptive anchor text.

## Images
- Every \`<img>\` needs an \`alt\` attribute. Empty alt (\`alt=""\`) is correct for decorative images.
- Use \`loading="lazy"\` for below-the-fold images.
- Provide \`width\` and \`height\` attributes to prevent layout shift.

## Voice rules
- Write in active voice.
- Avoid AI slop words: *delve*, *leverage*, *tapestry*, *holistic*, *robust*, *pivotal*, *transformative*, *paradigm*, *synergy*, *seamless*.
- Avoid hedging phrases: *it's important to note*, *at the end of the day*, *needless to say*.
- Vary sentence length — mix short punchy sentences with longer ones (burstiness CV > 0.3 is good).

## After writing
Run \`site_check\` with the page path to verify before finalising.
`,
};
