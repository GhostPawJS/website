import { access } from 'node:fs/promises';
import { defineCommand } from 'citty';
import { resolvePaths } from '../../project/paths.ts';
import { requireProject } from '../detect.ts';
import { c, fatal } from '../output.ts';
import { startServer } from '../server/start_server.ts';

export default defineCommand({
	meta: { name: 'start', description: 'Start the production HTTP server (serves dist/)' },
	args: {
		port: {
			type: 'string',
			description: 'Port to listen on (default: PORT env var or 3000)',
			default: '',
		},
		log: { type: 'boolean', description: 'Print one-line access log per request', default: false },
		'no-security-headers': {
			type: 'boolean',
			description: 'Disable security header injection (use behind a proxy that sets them)',
			default: false,
		},
		'trust-proxy': {
			type: 'boolean',
			description: 'Trust X-Forwarded-For / X-Forwarded-Proto headers',
			default: false,
		},
		timeout: {
			type: 'string',
			description: 'Request timeout in seconds (default: 30)',
			default: '30',
		},
	},
	async run({ args }) {
		const cwd = await requireProject();
		const { dist } = resolvePaths(cwd);
		const port = args.port ? parseInt(args.port, 10) : Number(process.env.PORT) || 3000;

		// Guard: dist/ must exist — catch the common mistake of running start before build
		try {
			await access(dist);
		} catch {
			fatal(`dist/ not found. Run ${c.cyan('npm run build')} first.`);
		}

		const config = await import('../../api/index.ts').then((m) => m.read.getConfig(cwd));

		console.log('');
		console.log(`  ${c.bold('@ghostpaw/website start')}`);
		console.log('');
		console.log(`  Serving  ${c.dim(dist)}`);
		console.log(`  Local    ${c.cyan(`http://localhost:${port}`)}`);
		console.log(`  Network  ${c.dim(`http://0.0.0.0:${port}`)}`);
		console.log(`  Project  ${c.dim(config.name)}`);
		console.log('');
		console.log(`  ${c.dim('Press Ctrl+C to stop')}`);
		console.log('');

		await startServer(dist, {
			port,
			log: args.log,
			noSecurityHeaders: args['no-security-headers'],
			trustProxy: args['trust-proxy'],
			timeout: parseInt(args.timeout, 10) * 1000,
		});
	},
});
