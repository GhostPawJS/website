/**
 * Seeds the in-memory filesystem with a complete demo site (Heliostat),
 * then runs the initial build so the preview panel has something to show.
 */
import { scaffold } from '../build/index.ts';
import { api } from '../index.ts';

export const DEMO_DIR = '/heliostat';

const NAV = [
	{ label: 'Home', href: '/' },
	{ label: 'About', href: '/about/' },
	{ label: 'Blog', href: '/blog/' },
	{ label: 'FAQ', href: '/faq/' },
];

const BASE_CSS = `
/* Heliostat demo styles */
*, *::before, *::after { box-sizing: border-box; }
body {
  font-family: system-ui, sans-serif;
  line-height: 1.6;
  color: #1a1a2e;
  margin: 0;
  background: #f8f9fa;
}
header {
  background: #16213e;
  color: #fff;
  padding: 1rem 2rem;
  display: flex;
  align-items: center;
  gap: 2rem;
}
header a { color: #e2b96f; text-decoration: none; font-weight: 600; }
header nav a { color: #ccc; font-weight: 400; }
header nav a:hover { color: #fff; }
nav { display: flex; gap: 1.5rem; }
main { max-width: 800px; margin: 2rem auto; padding: 0 1.5rem; }
h1 { color: #16213e; }
h2 { color: #0f3460; border-bottom: 2px solid #e2b96f; padding-bottom: 0.25rem; }
footer {
  text-align: center;
  padding: 2rem;
  color: #666;
  border-top: 1px solid #ddd;
  margin-top: 4rem;
}
.post-list { list-style: none; padding: 0; }
.post-item {
  border: 1px solid #dde;
  border-radius: 8px;
  padding: 1rem 1.5rem;
  margin-bottom: 1rem;
  background: #fff;
}
.post-title { font-size: 1.1rem; font-weight: 600; color: #0f3460; }
.post-date { font-size: 0.875rem; color: #666; margin-top: 0.25rem; }
.post-desc { margin-top: 0.5rem; color: #444; }
.faq-item { margin-bottom: 1.5rem; }
.faq-item h3 { color: #0f3460; margin-bottom: 0.5rem; }
.breadcrumb { font-size: 0.875rem; color: #666; margin-bottom: 1.5rem; }
.breadcrumb a { color: #0f3460; }
`;

export async function seedSite(): Promise<void> {
	// Scaffold the site structure
	await scaffold(DEMO_DIR, {
		name: 'Heliostat',
		url: 'https://heliostat.io',
		language: 'en',
	});

	// Override nav data
	await api.write.writeData(DEMO_DIR, 'nav', NAV);

	// Embed CSS directly into base.html as a <style> block so it's
	// self-contained in the srcdoc iframe (no external asset fetch needed).
	const baseHtml = await api.read.getTemplate(DEMO_DIR, 'base.html');
	const styledBase = baseHtml.replace('</head>', `<style>${BASE_CSS}</style>\n</head>`);
	await api.write.writeTemplate(DEMO_DIR, 'base.html', styledBase);

	// Homepage
	await api.write.writePage(
		DEMO_DIR,
		'index.md',
		{
			title: 'Heliostat — Solar Tracking Systems',
			description:
				'Precision solar tracking systems for residential and commercial installations. Maximize your energy yield with Heliostat technology.',
			layout: 'page.html',
			og_image: '/assets/og-home.jpg',
			keyword: 'solar tracking system',
		},
		`
## The sun moves. Your panels should too.

Heliostat designs single-axis and dual-axis solar tracking systems that follow the sun from dawn to dusk. Our tracking technology increases energy yield by 25–40% compared to fixed-tilt installations.

### Why tracking beats fixed panels

Fixed panels are optimised for a single point in the day. Tracking systems stay perpendicular to sunlight throughout the day. The physics is simple: more direct light means more power.

### Our systems

- **SingleAxis Pro** — east-west tracking for utility-scale arrays
- **DualAxis Elite** — full azimuth and elevation tracking for residential and commercial
- **RetroFit Kit** — add tracking to existing panel installations

Heliostat systems are engineered in Berlin and installed across Europe, North America, and Australia.
`,
	);

	// About page
	await api.write.writePage(
		DEMO_DIR,
		'about.md',
		{
			title: 'About Heliostat',
			description:
				'Founded in 2019 by engineers from the aerospace industry, Heliostat brings precision motion control to solar energy.',
			layout: 'page.html',
			keyword: 'solar tracking company',
			author: 'Heliostat Team',
		},
		`
## Our story

Heliostat was founded in Berlin in 2019 by a team of aerospace engineers who noticed that the motion-control systems used to track satellites were wildly over-engineered for solar applications.

We spent two years building a simpler, cheaper, and more reliable alternative. The result is a system with fewer moving parts, lower maintenance costs, and a 15-year service life.

### The team

Our engineering team has backgrounds in aerospace, robotics, and power electronics. We have installed over 3,000 tracking systems across 14 countries.

### Certifications

- IEC 61215 (crystalline silicon PV modules)
- UL 3703 (solar tracker systems)
- CE marking (EU)
`,
	);

	// Blog index
	await api.write.writePage(
		DEMO_DIR,
		'blog/_index.md',
		{
			title: 'Heliostat Blog',
			description:
				'Technical articles, case studies, and product updates from the Heliostat engineering team.',
			layout: 'blog.html',
			keyword: 'solar tracking blog',
		},
		'',
	);

	// Blog post 1
	await api.write.writePage(
		DEMO_DIR,
		'blog/dual-axis-yield-study.md',
		{
			title: 'Dual-Axis vs Fixed Tilt: 12-Month Yield Study',
			description:
				'We monitored side-by-side installations in southern Germany for 12 months. Dual-axis tracking delivered 38% more energy than the fixed reference array.',
			layout: 'post.html',
			datePublished: '2024-11-15',
			author: 'Dr. Anna Richter',
			keyword: 'dual axis solar tracker yield',
			og_image: '/assets/yield-study.jpg',
		},
		`
## Study overview

From January to December 2023 we ran a controlled comparison at our Augsburg test site. The reference array used fixed tilt at latitude angle (48°). The test array used our DualAxis Elite system.

Both arrays used identical 400 W panels from the same production batch. Total installed capacity: 20 kWp per array.

## Results

| Month | Fixed (kWh) | Dual-axis (kWh) | Gain |
|-------|------------|-----------------|------|
| January | 420 | 531 | +26% |
| June | 2,840 | 3,920 | +38% |
| December | 310 | 408 | +32% |
| **Annual** | **18,240** | **25,171** | **+38%** |

## Conclusion

Dual-axis tracking is most effective in summer and at latitudes above 40°. The 38% annual gain exceeds our original 30% design target.
`,
	);

	// Blog post 2
	await api.write.writePage(
		DEMO_DIR,
		'blog/single-axis-installation-guide.md',
		{
			title: 'SingleAxis Pro: Field Installation Guide',
			description:
				'Step-by-step installation guide for the SingleAxis Pro tracker. Covers site preparation, foundation options, and commissioning.',
			layout: 'post.html',
			datePublished: '2024-09-03',
			author: 'Mark Schreiber',
			keyword: 'solar tracker installation',
		},
		`
## Before you begin

Check that your site survey is complete and that you have the foundation type confirmed. The SingleAxis Pro supports ballasted, driven-pile, and concrete foundations.

## Tools required

- Torque wrench (40–120 Nm range)
- Inclinometer (± 0.1° accuracy)
- Laptop with Heliostat Configurator software

## Step 1 — Foundation

Install foundations according to the site plan. Allow concrete 72 hours to cure before mounting the tracker frame.

## Step 2 — Frame assembly

Attach the torque tube to the drive unit using M16 bolts. Torque to 95 Nm.

## Step 3 — Panel mounting

Mount panels to the torque tube using the supplied clamps. Maximum panel weight per clamp: 25 kg.

## Step 4 — Commissioning

Connect the controller, enter your GPS coordinates, and run the auto-calibration sequence. Calibration takes approximately 8 minutes.
`,
	);

	// FAQ page
	await api.write.writePage(
		DEMO_DIR,
		'faq.md',
		{
			title: 'Frequently Asked Questions — Heliostat Solar Trackers',
			description:
				'Answers to common questions about Heliostat solar tracking systems: installation, maintenance, yield, and pricing.',
			layout: 'page.html',
			keyword: 'solar tracker FAQ',
			faqs: [
				{
					q: 'How much does a solar tracker increase energy yield?',
					a: 'Our single-axis systems increase yield by 20–28%. Dual-axis systems deliver 30–40% more energy than a fixed-tilt reference array at the same location.',
				},
				{
					q: 'How often does the tracker need maintenance?',
					a: 'The drive unit requires annual inspection and lubrication. The controller firmware updates automatically over Wi-Fi. Expected service interval: once per year.',
				},
				{
					q: 'Can Heliostat trackers be retrofitted to existing panels?',
					a: 'Yes. Our RetroFit Kit is designed for existing installations with standard rail mounting systems. Contact us for a compatibility assessment.',
				},
				{
					q: 'What happens during high winds?',
					a: 'The tracker includes a wind stow function. When wind speed exceeds 12 m/s, the array moves to a flat stow position to minimise wind load.',
				},
			],
		},
		'Have a question not listed here? [Contact our team](mailto:info@heliostat.io).',
	);

	// Run initial build
	await api.build.build(DEMO_DIR);
}
