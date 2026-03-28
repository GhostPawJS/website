import { resolvePaths } from '../../project/paths.ts';
import { loadSiteConfig, writeSiteConfig } from '../../project/site_config.ts';
import type { SiteConfig } from '../../types.ts';

/**
 * Merge `partial` into the existing `site.json` and write it back.
 * Existing fields not present in `partial` are preserved.
 */
export async function writeConfig(dir: string, partial: Partial<SiteConfig>): Promise<void> {
	const paths = resolvePaths(dir);
	const current = await loadSiteConfig(paths.siteJson);
	const updated: SiteConfig = { ...current, ...partial };
	await writeSiteConfig(paths.siteJson, updated);
}
