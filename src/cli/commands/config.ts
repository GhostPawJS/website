import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { defineCommand } from 'citty';
import { requireProject } from '../detect.ts';
import { c } from '../output.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function readSiteJson(cwd: string): Promise<Record<string, unknown>> {
	const raw = await readFile(join(cwd, 'site.json'), 'utf8');
	return JSON.parse(raw) as Record<string, unknown>;
}

async function writeSiteJson(cwd: string, config: Record<string, unknown>): Promise<void> {
	await writeFile(join(cwd, 'site.json'), `${JSON.stringify(config, null, '\t')}\n`);
}

/** Read a value from a nested object using dot-notation key. */
function getNestedKey(obj: Record<string, unknown>, dotPath: string): unknown {
	let current: unknown = obj;
	for (const key of dotPath.split('.')) {
		if (typeof current !== 'object' || current === null) return undefined;
		current = (current as Record<string, unknown>)[key];
	}
	return current;
}

/** Set a value in a nested object using dot-notation key (mutates in place). */
function setNestedKey(obj: Record<string, unknown>, dotPath: string, value: unknown): void {
	const keys = dotPath.split('.');
	let current = obj;
	for (let i = 0; i < keys.length - 1; i++) {
		const key = keys[i] as string;
		if (typeof current[key] !== 'object' || current[key] === null) {
			current[key] = {};
		}
		current = current[key] as Record<string, unknown>;
	}
	const lastKey = keys[keys.length - 1] as string;
	current[lastKey] = value;
}

/** Parse a CLI value string: try JSON, fall back to plain string. */
function parseCliValue(s: string): unknown {
	try {
		return JSON.parse(s);
	} catch {
		return s;
	}
}

// ---------------------------------------------------------------------------
// `website config get [key]`
// ---------------------------------------------------------------------------

const getCommand = defineCommand({
	meta: { name: 'get', description: 'Read site.json (or a specific key)' },
	args: {
		key: {
			type: 'positional',
			description: 'Dot-notation key (e.g. fitness.voice.bannedWords). Omit for full config.',
			required: false,
			default: '',
		},
	},
	async run({ args }) {
		const cwd = await requireProject();
		const config = await readSiteJson(cwd);
		const value = args.key ? getNestedKey(config, args.key) : config;
		console.log(JSON.stringify(value, null, 2));
	},
});

// ---------------------------------------------------------------------------
// `website config set <key> <value>`
// ---------------------------------------------------------------------------

const setCommand = defineCommand({
	meta: { name: 'set', description: 'Update a site.json value' },
	args: {
		key: {
			type: 'positional',
			description: 'Dot-notation key (e.g. url, fitness.voice.burstinessMin)',
			required: true,
		},
		value: {
			type: 'positional',
			description: 'Value to set (JSON-parsed if valid JSON, otherwise plain string)',
			required: true,
		},
	},
	async run({ args }) {
		const cwd = await requireProject();
		const config = await readSiteJson(cwd);

		const before = getNestedKey(config, args.key);
		const parsed = parseCliValue(args.value);
		setNestedKey(config, args.key, parsed);

		await writeSiteJson(cwd, config);

		console.log('');
		console.log(`  ${c.dim('site.json updated')}`);
		console.log(
			`  ${args.key}:  ${c.dim(JSON.stringify(before))}  →  ${c.green(JSON.stringify(parsed))}`,
		);
		console.log('');
	},
});

// ---------------------------------------------------------------------------
// `website config` — parent command
// ---------------------------------------------------------------------------

export default defineCommand({
	meta: { name: 'config', description: 'Read or update site.json' },
	subCommands: {
		get: getCommand,
		set: setCommand,
	},
});
