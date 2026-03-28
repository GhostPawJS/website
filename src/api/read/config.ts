import { loadDomain } from '../../project/domain.ts';
import { resolvePaths } from '../../project/paths.ts';
import { loadPersona } from '../../project/persona.ts';
import { loadSiteConfig } from '../../project/site_config.ts';
import type { SiteConfig } from '../../types.ts';

/** Return the parsed `site.json` for the project at `dir`. */
export async function getConfig(dir: string): Promise<SiteConfig> {
	const paths = resolvePaths(dir);
	return loadSiteConfig(paths.siteJson);
}

/** Return the raw DOMAIN.md content. Returns `''` if the file does not exist. */
export async function getDomain(dir: string): Promise<string> {
	const paths = resolvePaths(dir);
	return loadDomain(paths.domainMd);
}

/** Return the raw PERSONA.md content. Returns `''` if the file does not exist. */
export async function getPersona(dir: string): Promise<string> {
	const paths = resolvePaths(dir);
	return loadPersona(paths.personaMd);
}
