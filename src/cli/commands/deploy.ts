import { access, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { defineCommand } from 'citty';
import { requireProject } from '../detect.ts';
import { c } from '../output.ts';

// ---------------------------------------------------------------------------
// Config file templates
// ---------------------------------------------------------------------------

const GITHUB_PAGES_WORKFLOW = `name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

permissions:
  pages: write
  id-token: write

jobs:
  deploy:
    environment:
      name: github-pages
      url: \${{ steps.deploy.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: npm
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
      - id: deploy
        uses: actions/deploy-pages@v4
`;

const NETLIFY_TOML = `[build]
  command = "npm run build"
  publish = "dist"

[[headers]]
  for = "/*"
  [headers.values]
    X-Content-Type-Options = "nosniff"
    X-Frame-Options = "SAMEORIGIN"
    Referrer-Policy = "strict-origin-when-cross-origin"
`;

const DOCKERFILE = `# syntax=docker/dockerfile:1
FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-alpine AS runner
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY --from=builder /app/dist ./dist
ENV PORT=3000
EXPOSE 3000
CMD ["npm", "run", "start"]
`;

const DOCKERIGNORE = `node_modules
.git
*.log
`;

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

async function writeIfAbsent(filePath: string, content: string, _label: string): Promise<boolean> {
	try {
		await access(filePath);
		return false; // already exists
	} catch {
		await mkdir(dirname(filePath), { recursive: true });
		await writeFile(filePath, content);
		return true;
	}
}

// ---------------------------------------------------------------------------
// Command
// ---------------------------------------------------------------------------

export default defineCommand({
	meta: { name: 'deploy', description: 'Generate deployment config files' },
	args: {
		'github-pages': {
			type: 'boolean',
			description: 'Write .github/workflows/pages.yml for GitHub Pages',
			default: false,
		},
		netlify: { type: 'boolean', description: 'Write netlify.toml for Netlify', default: false },
		cloudflare: {
			type: 'boolean',
			description: 'Print Cloudflare Pages setup instructions',
			default: false,
		},
		docker: {
			type: 'boolean',
			description: 'Write Dockerfile + .dockerignore for self-hosting',
			default: false,
		},
	},
	async run({ args }) {
		const cwd = await requireProject();

		const anyFlag = args['github-pages'] || args.netlify || args.cloudflare || args.docker;

		if (!anyFlag) {
			console.log('');
			console.log(`  ${c.bold('website deploy')} — choose a deployment target:`);
			console.log('');
			console.log(
				`  ${c.cyan('--github-pages')}   GitHub Actions → GitHub Pages (free static hosting)`,
			);
			console.log(`  ${c.cyan('--netlify')}        Netlify (free tier, fast CDN)`);
			console.log(`  ${c.cyan('--cloudflare')}     Cloudflare Pages (free tier, global edge)`);
			console.log(`  ${c.cyan('--docker')}         Dockerfile for self-hosted Node server`);
			console.log('');
			return;
		}

		console.log('');

		if (args['github-pages']) {
			const target = join(cwd, '.github', 'workflows', 'pages.yml');
			const written = await writeIfAbsent(target, GITHUB_PAGES_WORKFLOW, 'pages.yml');
			if (written) {
				console.log(`  ${c.green('Created')}  .github/workflows/pages.yml`);
				console.log(`  ${c.dim('Push to main, then enable Pages in your repo:')}`);
				console.log(`  ${c.dim('Settings → Pages → Source: GitHub Actions')}`);
			} else {
				console.log(
					`  ${c.dim('Skipped')}  .github/workflows/pages.yml ${c.dim('(already exists)')}`,
				);
			}
			console.log('');
		}

		if (args.netlify) {
			const target = join(cwd, 'netlify.toml');
			const written = await writeIfAbsent(target, NETLIFY_TOML, 'netlify.toml');
			if (written) {
				console.log(`  ${c.green('Created')}  netlify.toml`);
				console.log(`  ${c.dim('Connect your repo at app.netlify.com → Add new site')}`);
			} else {
				console.log(`  ${c.dim('Skipped')}  netlify.toml ${c.dim('(already exists)')}`);
			}
			console.log('');
		}

		if (args.cloudflare) {
			console.log(`  ${c.bold('Cloudflare Pages')} — no config file needed for static deploys`);
			console.log('');
			console.log(`  1. Go to ${c.cyan('dash.cloudflare.com')} → Workers & Pages → Create`);
			console.log(`  2. Connect your GitHub/GitLab repo`);
			console.log(`  3. Set build settings:`);
			console.log(`     ${c.dim('Build command:')}    npm run build`);
			console.log(`     ${c.dim('Output directory:')} dist`);
			console.log(`     ${c.dim('Node version:')}     24`);
			console.log('');
		}

		if (args.docker) {
			const dfWritten = await writeIfAbsent(join(cwd, 'Dockerfile'), DOCKERFILE, 'Dockerfile');
			const diWritten = await writeIfAbsent(
				join(cwd, '.dockerignore'),
				DOCKERIGNORE,
				'.dockerignore',
			);

			if (dfWritten) console.log(`  ${c.green('Created')}  Dockerfile`);
			else console.log(`  ${c.dim('Skipped')}  Dockerfile ${c.dim('(already exists)')}`);

			if (diWritten) console.log(`  ${c.green('Created')}  .dockerignore`);
			else console.log(`  ${c.dim('Skipped')}  .dockerignore ${c.dim('(already exists)')}`);

			console.log('');
			console.log(`  ${c.dim('Build and run:')}`);
			console.log(`  docker build -t my-site . && docker run -p 3000:3000 my-site`);
			console.log('');
			console.log(
				`  ${c.dim('Note: @ghostpaw/website must be in dependencies (not devDependencies) for Docker.')}`,
			);
			console.log(`  Run: ${c.cyan('npm install @ghostpaw/website --save')}`);
			console.log('');
		}
	},
});
