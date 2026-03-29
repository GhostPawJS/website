import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { fatal } from './output.ts';

/**
 * Verify the current working directory is a @ghostpaw/website project
 * (has a site.json). Prints a clear error and exits if not.
 *
 * Returns the absolute CWD path for convenience.
 */
export async function requireProject(): Promise<string> {
	const cwd = process.cwd();
	try {
		await access(join(cwd, 'site.json'));
	} catch {
		fatal(
			'Not a @ghostpaw/website project.\n\n' +
				'  Navigate to your project folder, or create a new site:\n\n' +
				'    npx @ghostpaw/website init',
		);
	}
	return cwd;
}
