import { parseArgs as nodeParseArgs } from 'node:util';

export interface Argument {
	type: 'string' | 'boolean' | 'positional';
	description: string;
	default?: string | boolean;
	required?: boolean;
}
type Arguments = Record<string, Argument>;
type Values<T extends Arguments> = {
	[K in keyof T]: T[K]['type'] extends 'boolean' ? boolean : string;
};
export interface Command<T extends Arguments = Arguments> {
	meta: { name: string; description: string; version?: string };
	args?: T;
	subCommands?: Record<string, Command>;
	run?(context: { args: Values<T> }): unknown;
}

/** Preserve the inferred argument types used by command implementations. */
export function defineCommand<const T extends Arguments>(command: Command<T>): Command<T> {
	return command;
}

const camelCase = (name: string) =>
	name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());

/** Parse the existing CLI options, including negation and camelCase aliases. */
export function parseCommandArgs<T extends Arguments>(raw: string[], definitions: T): Values<T> {
	const options: Record<string, { type: 'boolean' | 'string'; default?: string | boolean }> = {};
	for (const [name, arg] of Object.entries(definitions)) {
		if (arg.type === 'positional') continue;
		options[name] = { type: arg.type };
		if (arg.default !== undefined) options[name].default = arg.default;
		if (camelCase(name) !== name) options[camelCase(name)] = { type: arg.type };
	}
	const negated: string[] = [];
	const processed: string[] = [];
	for (let i = 0; i < raw.length; i++) {
		const value = raw[i] as string;
		if (value === '--') {
			processed.push(...raw.slice(i));
			break;
		}
		if (value.startsWith('--no-')) negated.push(value.slice(5));
		else processed.push(value);
	}
	let values: Record<string, string | boolean | undefined>;
	let positionals: string[];
	try {
		({ values, positionals } = nodeParseArgs({
			args: processed,
			options,
			strict: false,
			allowPositionals: true,
		}));
	} catch {
		values = {};
		positionals = processed;
	}
	for (const name of negated) {
		values[name] = false;
		values[camelCase(name)] = false;
	}
	let index = 0;
	for (const [name, arg] of Object.entries(definitions)) {
		if (arg.type === 'positional') {
			const value = positionals[index++];
			if (value === undefined && arg.default === undefined && arg.required !== false)
				throw new Error(`Missing required positional argument: ${name.toUpperCase()}`);
			values[name] = value ?? arg.default;
		} else {
			// Preserve the existing precedence: canonical defaults precede aliases.
			if (
				camelCase(name) !== name &&
				values[name] === undefined &&
				values[camelCase(name)] !== undefined
			)
				values[name] = values[camelCase(name)];
			if (arg.required && values[name] === undefined)
				throw new Error(`Missing required argument: --${name}`);
		}
	}
	return { ...values } as Values<T>;
}

/** Render usage with the same descriptions, defaults, and command hierarchy. */
export function renderUsage(command: Command, parent?: Command): string {
	const name = `${parent ? `${parent.meta.name} ` : ''}${command.meta.name}`;
	const positionals: string[][] = [];
	const options: string[][] = [];
	const usage: string[] = [];
	for (const [key, arg] of Object.entries(command.args || {})) {
		if (arg.type === 'positional') {
			const label = key.toUpperCase();
			positionals.push([label + (arg.default ? `="${arg.default}"` : ''), arg.description]);
			usage.push(arg.required !== false && arg.default === undefined ? `<${label}>` : `[${label}]`);
		} else
			options.push([
				`--${key}${arg.type === 'string' && arg.default ? `="${arg.default}"` : ''}`,
				arg.description,
			]);
	}
	const commands = Object.entries(command.subCommands || {}).map(([key, sub]) => [
		key,
		sub.meta.description,
	]);
	if (commands.length) usage.push(commands.map(([key]) => key).join('|'));
	const version = command.meta.version || parent?.meta.version;
	const lines = [
		`${command.meta.description} (${name}${version ? ` v${version}` : ''})`,
		'',
		`USAGE ${name}${options.length || positionals.length ? ' [OPTIONS]' : ''} ${usage.join(' ')}`,
		'',
	];
	for (const [label, rows] of [
		['ARGUMENTS', positionals],
		['OPTIONS', options],
		['COMMANDS', commands],
	] as const) {
		if (!rows.length) continue;
		const width = Math.max(...rows.map(([key]) => (key || '').length));
		lines.push(
			label,
			'',
			...rows.map(([key, description]) => `  ${(key || '').padEnd(width)}  ${description}`),
			'',
		);
	}
	if (commands.length)
		lines.push(`Use ${name} <command> --help for more information about a command.`);
	return lines.join('\n');
}

/** Dispatch commands and preserve the CLI's help, version, and failure exit codes. */
export async function runMain(command: Command, raw = process.argv.slice(2)): Promise<void> {
	let selected = command;
	let parent: Command | undefined;
	let args = raw;
	while (selected.subCommands) {
		const index = args.findIndex((arg) => !arg.startsWith('-'));
		const sub = selected.subCommands[args[index] || ''];
		if (!sub) break;
		parent = selected;
		selected = sub;
		args = args.slice(index + 1);
	}
	const showUsage = () => console.log(`${renderUsage(selected, parent)}\n`);
	try {
		if (raw.includes('--help') || raw.includes('-h')) {
			showUsage();
			return;
		}
		if (raw.length === 1 && raw[0] === '--version') {
			console.log(command.meta.version);
			return;
		}
		if (selected.subCommands) {
			const unknown = args.find((arg) => !arg.startsWith('-'));
			throw new Error(unknown ? `Unknown command ${unknown}` : 'No command specified.');
		}
		let parsed: Values<Arguments>;
		try {
			parsed = parseCommandArgs(args, selected.args || {});
		} catch (error) {
			showUsage();
			throw error;
		}
		await selected.run?.({ args: parsed });
	} catch (error) {
		if (selected.subCommands) showUsage();
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	}
}
