import { SiteError } from '../../errors.ts';
import { resolvePaths } from '../../project/paths.ts';
import { loadDataFiles } from '../../render/template_context.ts';
import type { DataSummary } from '../../types.ts';

/** Return a summary of every data file (name + top-level shape). */
export async function listData(dir: string): Promise<DataSummary[]> {
	const paths = resolvePaths(dir);
	const data = await loadDataFiles(paths.data);
	return Object.entries(data).map(([name, value]) => ({
		name,
		shape: Array.isArray(value) ? ['[array]'] : Object.keys(value as object).slice(0, 20),
	}));
}

/**
 * Return the parsed JSON content of a data file by name (without `.json` extension).
 * Throws `SiteError('not_found')` if the data file does not exist.
 */
export async function getData(dir: string, name: string): Promise<unknown> {
	const paths = resolvePaths(dir);
	const data = await loadDataFiles(paths.data);
	if (!(name in data)) throw new SiteError('not_found', `Data file not found: "${name}"`);
	return data[name];
}
