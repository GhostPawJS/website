import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { defineCommand } from 'citty';
import * as api from '../../api/index.ts';
import { resolvePaths } from '../../project/paths.ts';
import { requireProject } from '../detect.ts';
import { c, fatal } from '../output.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert a file slug to a human-readable title. */
function slugToTitle(slug: string): string {
	const last = slug.split('/').at(-1) ?? slug;
	return last.replace(/[-_]+/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function today(): string {
	return new Date().toISOString().slice(0, 10);
}

async function guardNoOverwrite(cwd: string, path: string): Promise<void> {
	const { content } = resolvePaths(cwd);
	const absPath = join(content, path.endsWith('.md') ? path : `${path}.md`);
	try {
		await access(absPath);
		fatal(
			`File already exists: content/${path}.md\n\n  Use a different slug, or edit the file directly.`,
		);
	} catch {
		// doesn't exist — good
	}
}

// ---------------------------------------------------------------------------
// `website new page <slug>`
// ---------------------------------------------------------------------------

const pageCommand = defineCommand({
	meta: { name: 'page', description: 'Create a new content page' },
	args: {
		slug: {
			type: 'positional',
			description: 'Page slug relative to content/ (e.g. about/team)',
			required: true,
		},
		title: { type: 'string', description: 'Page title (defaults to slug)', default: '' },
	},
	async run({ args }) {
		const cwd = await requireProject();
		const slug = args.slug.replace(/\.md$/, '');
		const title = args.title || slugToTitle(slug);
		const path = `${slug}.md`;

		await guardNoOverwrite(cwd, path);

		await api.write.writePage(
			cwd,
			path,
			{
				title,
				description: '',
				layout: 'page.html',
				datePublished: today(),
			},
			`## ${title}\n\nWrite your content here.\n`,
		);

		const url = `/${slug}/`;
		console.log('');
		console.log(`  ${c.green('Created')}  content/${path}`);
		console.log(`  ${c.dim(`Edit the file, then check: website check --page ${url}`)}`);
		console.log('');
	},
});

// ---------------------------------------------------------------------------
// `website new post <slug>`
// ---------------------------------------------------------------------------

const postCommand = defineCommand({
	meta: { name: 'post', description: 'Create a new blog post' },
	args: {
		slug: {
			type: 'positional',
			description: 'Post slug relative to content/ (e.g. blog/my-first-post)',
			required: true,
		},
		title: { type: 'string', description: 'Post title (defaults to slug)', default: '' },
	},
	async run({ args }) {
		const cwd = await requireProject();
		const slug = args.slug.replace(/\.md$/, '');
		const title = args.title || slugToTitle(slug);
		const path = `${slug}.md`;

		await guardNoOverwrite(cwd, path);

		await api.write.writePage(
			cwd,
			path,
			{
				title,
				description: '',
				layout: 'post.html',
				datePublished: today(),
				author: '',
				keyword: '',
			},
			`## ${title}\n\nWrite your post here.\n`,
		);

		const url = `/${slug}/`;
		console.log('');
		console.log(`  ${c.green('Created')}  content/${path}`);
		console.log(`  ${c.dim(`Edit the file, then check: website check --page ${url}`)}`);
		console.log('');
	},
});

// ---------------------------------------------------------------------------
// `website new` — parent command
// ---------------------------------------------------------------------------

export default defineCommand({
	meta: { name: 'new', description: 'Create new content (page or post)' },
	subCommands: {
		page: pageCommand,
		post: postCommand,
	},
});
