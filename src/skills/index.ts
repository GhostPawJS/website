// ---------------------------------------------------------------------------
// Skills public API
// ---------------------------------------------------------------------------

export { contentCannibalization } from './content_cannibalization.ts';
export { createPageWell } from './create_page_well.ts';
export { geoOptimization } from './geo_optimization.ts';
export { searchConsoleWorkflow } from './search_console_workflow.ts';
export { seoChecklist } from './seo_checklist.ts';
export { siteLaunchChecklist } from './site_launch_checklist.ts';
export { templateComposition } from './template_composition.ts';
export type { Skill } from './types.ts';

import { contentCannibalization } from './content_cannibalization.ts';
import { createPageWell } from './create_page_well.ts';
import { geoOptimization } from './geo_optimization.ts';
import { searchConsoleWorkflow } from './search_console_workflow.ts';
import { seoChecklist } from './seo_checklist.ts';
import { siteLaunchChecklist } from './site_launch_checklist.ts';
import { templateComposition } from './template_composition.ts';
import type { Skill } from './types.ts';

/** All skills in alphabetical order by name. */
export const SKILLS: readonly Skill[] = [
	contentCannibalization,
	createPageWell,
	geoOptimization,
	searchConsoleWorkflow,
	seoChecklist,
	siteLaunchChecklist,
	templateComposition,
];
