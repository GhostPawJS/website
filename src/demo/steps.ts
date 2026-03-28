/**
 * Pre-configured demo steps shown in the tool panel.
 *
 * Each step is a pre-filled tool call with a title, description, and
 * default input. The user can edit the JSON before running.
 */

export interface DemoStep {
	id: string;
	title: string;
	tool: 'site_read' | 'site_write' | 'site_build' | 'site_check' | 'site_plan';
	description: string;
	input: Record<string, unknown>;
}

export const DEMO_STEPS: DemoStep[] = [
	{
		id: 'list-pages',
		title: '1 · List all pages',
		tool: 'site_read',
		description: 'Inspect what pages the site currently has.',
		input: { action: 'list_pages' },
	},
	{
		id: 'fitness-check',
		title: '2 · Run fitness check',
		tool: 'site_check',
		description: 'Score all 19 dimensions and surface the top issues. Target ≥ 80 for launch.',
		input: {},
	},
	{
		id: 'fitness-page',
		title: '3 · Score a single page',
		tool: 'site_read',
		description: 'Get the fitness score for the homepage only — faster than a full check.',
		input: { action: 'fitness_page', path: '/' },
	},
	{
		id: 'plan-new-post',
		title: '4 · Plan a new blog post',
		tool: 'site_plan',
		description: 'Simulate adding a case study post and preview the fitness delta before writing.',
		input: {
			changes: [
				{
					action: 'write_page',
					path: 'blog/rooftop-case-study.md',
					frontmatter: {
						title: 'Case Study: 80 kWp Rooftop Installation in Munich',
						description:
							'How a Munich logistics firm cut their electricity bill by 42% with a Heliostat DualAxis Elite rooftop installation.',
						layout: 'post.html',
						datePublished: '2025-01-20',
						author: 'Heliostat Team',
						keyword: 'rooftop solar tracker case study',
						og_image: '/assets/munich-rooftop.jpg',
					},
					content:
						'## The project\n\nIn Q3 2024 we installed 200 DualAxis Elite units across the 4,000 m² rooftop of a logistics centre near Munich.\n\n## Results\n\nAnnual yield increased from 68 MWh (fixed reference) to 97 MWh. Electricity costs fell by 42%.\n\n## Lessons learned\n\nRooftop installations require additional wind analysis. We used our WindSafe assessment tool to validate the stow angle before commissioning.',
				},
			],
		},
	},
	{
		id: 'write-new-post',
		title: '5 · Write the new blog post',
		tool: 'site_write',
		description:
			'Apply the planned case study post to disk. The preview will rebuild automatically.',
		input: {
			action: 'write_page',
			path: 'blog/rooftop-case-study.md',
			frontmatter: {
				title: 'Case Study: 80 kWp Rooftop Installation in Munich',
				description:
					'How a Munich logistics firm cut their electricity bill by 42% with a Heliostat DualAxis Elite rooftop installation.',
				layout: 'post.html',
				datePublished: '2025-01-20',
				author: 'Heliostat Team',
				keyword: 'rooftop solar tracker case study',
				og_image: '/assets/munich-rooftop.jpg',
			},
			content:
				'## The project\n\nIn Q3 2024 we installed 200 DualAxis Elite units across the 4,000 m² rooftop of a logistics centre near Munich.\n\n## Results\n\nAnnual yield increased from 68 MWh (fixed reference) to 97 MWh. Electricity costs fell by 42%.\n\n## Lessons learned\n\nRooftop installations require additional wind analysis. We used our WindSafe assessment tool to validate the stow angle before commissioning.',
		},
	},
	{
		id: 'patch-frontmatter',
		title: '6 · Patch frontmatter without rewriting',
		tool: 'site_write',
		description: 'Add an og_image to the About page without touching its content body.',
		input: {
			action: 'patch_frontmatter',
			path: 'about.md',
			frontmatter: {
				og_image: '/assets/og-about.jpg',
				dateModified: '2025-01-21',
			},
		},
	},
	{
		id: 'verify-score',
		title: '7 · Verify fitness improvement',
		tool: 'site_check',
		description:
			'Re-run the full fitness check after writes to confirm the score moved in the right direction.',
		input: {},
	},
];
