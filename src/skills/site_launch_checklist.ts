import type { Skill } from './types.ts';

export const siteLaunchChecklist: Skill = {
	name: 'site-launch-checklist',
	description: 'Pre-launch fitness threshold targets per dimension and final verification steps.',
	whenToUse: 'When preparing a site for production launch or doing a final quality gate check.',
	content: `# Site Launch Checklist

## Fitness score targets

Run \`site_check\` and verify all dimensions are at or above these thresholds:

| Dimension | Minimum | Recommended |
|---|---|---|
| seo_meta | 80 | 90 |
| seo_structure | 80 | 90 |
| content_quality | 70 | 80 |
| images | 85 | 95 |
| links | 90 | 100 |
| social | 75 | 85 |
| sitemap_robots | 90 | 100 |
| technical | 80 | 90 |
| schema_validation | 80 | 90 |
| geo | 70 | 80 |
| eeat | 70 | 80 |
| voice_compliance | 75 | 85 |

Overall score target: **≥ 80** before launch.

## Zero-error rule

No fitness issue with severity **error** should be present at launch. Warnings are acceptable but document them. Info items are advisory.

## Pre-launch steps

### 1. Build and verify
\`\`\`
site_build: { action: "clean" }
site_build: { action: "build" }
\`\`\`

### 2. Full fitness run
\`\`\`
site_check: {}
\`\`\`
Fix all errors. Address warnings where feasible.

### 3. Page-level spot checks
Check your 5 most important pages individually:
\`\`\`
site_check: { page: "/" }
site_check: { page: "/about/" }
\`\`\`

### 4. Sitemap and robots.txt
Verify \`sitemap.xml\` and \`robots.txt\` are present in \`dist/\`:
\`\`\`
site_read: { action: "get_asset", path: "robots.txt" }
\`\`\`

### 5. Canonical URLs
All canonical URLs must use the production \`https://\` domain (no \`http://\`, no trailing-slash inconsistencies).
Check \`site.json\` has the correct \`url\` field:
\`\`\`
site_read: { action: "get_config" }
\`\`\`

### 6. OG images
All pages with social sharing should have an \`og:image\` pointing to a 1200×630 image.
Run \`site_check\` with \`dimensions: ["social"]\` to find gaps.

### 7. Internal link integrity
\`site_check\` with \`dimensions: ["links"]\` — zero broken internal links.

### 8. Schema validation
\`site_check\` with \`dimensions: ["schema_validation"]\` — verify JSON-LD is valid.

### 9. Final history baseline
Run a final full fitness check to write the baseline history entry:
\`\`\`
site_read: { action: "fitness" }
\`\`\`
This creates the first entry in \`.fitness-history.json\` to track regressions from.

## Post-launch monitoring

After connecting Google Search Console, pass GSC data to \`site_check\`:
\`\`\`
site_check: { searchConsole: <gsc_data> }
\`\`\`
Look for \`keyword_opportunity\` and \`low_ctr\` issues weekly.
`,
};
