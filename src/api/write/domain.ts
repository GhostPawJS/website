import { writeDomain as projectWriteDomain } from '../../project/domain.ts';
import { resolvePaths } from '../../project/paths.ts';

/** Create or overwrite `DOMAIN.md` with `content`. */
export async function writeDomain(dir: string, content: string): Promise<void> {
	const paths = resolvePaths(dir);
	await projectWriteDomain(paths.domainMd, content);
}
