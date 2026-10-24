import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { defineCommand, parseCommandArgs, renderUsage, runMain } from './command.ts';

const args = {
	name: { type: 'positional', description: 'Name', required: true },
	port: { type: 'string', description: 'Port', default: '3000' },
	json: { type: 'boolean', description: 'JSON', default: false },
	'trust-proxy': { type: 'boolean', description: 'Trust proxy', default: false },
} as const;

describe('command argument parsing', () => {
	it('preserves defaults and positionals', () => {
		assert.deepEqual(parseCommandArgs(['site'], args), {
			name: 'site',
			port: '3000',
			json: false,
			'trust-proxy': false,
		});
	});
	it('accepts equals, values, repeated options, and booleans', () => {
		const parsed = parseCommandArgs(['site', '--port=4000', '--port', '5000', '--json'], args);
		assert.equal(parsed.port, '5000');
		assert.equal(parsed.json, true);
	});
	it('supports negation and camelCase options', () => {
		const parsed = parseCommandArgs(['site', '--json', '--no-json', '--trustProxy'], args);
		assert.equal(parsed.json, false);
		assert.equal(parsed['trust-proxy'], false);
	});
	it('honors the end-of-options marker', () => {
		assert.equal(parseCommandArgs(['--', '--no-json'], args).name, '--no-json');
	});
	it('reports missing positional and named arguments', () => {
		assert.throws(() => parseCommandArgs([], args), /Missing required positional argument: NAME/);
		assert.throws(
			() => parseCommandArgs([], { url: { type: 'string', description: '', required: true } }),
			/Missing required argument: --url/,
		);
	});
	it('retains the fallback for invalid boolean values', () => {
		assert.equal(parseCommandArgs(['site', '--json=yes'], args).name, 'site');
	});
	it('accepts optional positional defaults', () => {
		assert.equal(
			parseCommandArgs([], {
				dir: { type: 'positional', description: '', required: false, default: '.' },
			}).dir,
			'.',
		);
	});
});

describe('command dispatch and usage', () => {
	it('dispatches nested commands with typed arguments', async () => {
		let actual = '';
		const leaf = defineCommand({
			meta: { name: 'leaf', description: 'Leaf' },
			args,
			run({ args }) {
				actual = args.name;
			},
		});
		const main = defineCommand({
			meta: { name: 'main', description: 'Main' },
			subCommands: { leaf },
		});
		await runMain(main, ['leaf', 'site']);
		assert.equal(actual, 'site');
		const help = renderUsage(leaf, main);
		assert.match(help, /main leaf \[OPTIONS\] <NAME>/);
		assert.match(help, /--port="3000"/);
		assert.match(help, /ARGUMENTS/);
	});
	for (const raw of [
		[],
		['--help'],
		['-h'],
		['leaf', '--help'],
		['--version'],
		['unknown'],
		['leaf'],
	]) {
		it(`dispatch ${raw.join(' ') || '(no command)'}`, async (t) => {
			const output: string[] = [];
			const errors: string[] = [];
			t.mock.method(console, 'log', (text: string) => output.push(text));
			t.mock.method(console, 'error', (text: string) => errors.push(text));
			const previousExitCode = process.exitCode;
			t.after(() => {
				process.exitCode = previousExitCode;
			});
			const main = defineCommand({
				meta: { name: 'main', description: 'Main', version: '1.0.0' },
				subCommands: { leaf: defineCommand({ meta: { name: 'leaf', description: 'Leaf' }, args }) },
			});
			await runMain(main, raw);
			const fails = raw.length === 0 || raw.includes('unknown') || raw.join(' ') === 'leaf';
			assert.equal(process.exitCode, fails ? 1 : previousExitCode);
			if (raw.includes('unknown')) assert.match(errors.join(''), /Unknown command unknown/);
			if (raw.includes('--version')) assert.equal(output.join('').trim(), '1.0.0');
			else assert.match(output.join(''), /USAGE/);
		});
	}
});
