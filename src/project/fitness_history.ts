import { isSiteError } from '../errors.ts';
import { readFile } from '../fs/read_file.ts';
import { writeFile } from '../fs/write_file.ts';
import type { FitnessHistoryEntry } from '../types.ts';

const MAX_ENTRIES = 100;

/**
 * Load `.fitness-history.json`. Returns empty array if missing.
 */
export async function loadFitnessHistory(filePath: string): Promise<FitnessHistoryEntry[]> {
	try {
		const raw = await readFile(filePath);
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed as FitnessHistoryEntry[];
	} catch (err) {
		if (isSiteError(err) && err.code === 'not_found') return [];
		return [];
	}
}

/**
 * Append `entry` to the history file, capping at `MAX_ENTRIES` most recent.
 */
export async function appendFitnessHistory(
	filePath: string,
	entry: FitnessHistoryEntry,
): Promise<void> {
	const history = await loadFitnessHistory(filePath);
	history.push(entry);
	const trimmed = history.slice(-MAX_ENTRIES);
	await writeFile(filePath, `${JSON.stringify(trimmed, null, '\t')}\n`);
}
