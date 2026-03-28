import { resolvePaths } from '../../project/paths.ts';
import { writePersona as projectWritePersona } from '../../project/persona.ts';

/** Create or overwrite `PERSONA.md` with `content`. */
export async function writePersona(dir: string, content: string): Promise<void> {
	const paths = resolvePaths(dir);
	await projectWritePersona(paths.personaMd, content);
}
