// ---------------------------------------------------------------------------
// Tools public API
// ---------------------------------------------------------------------------

export type { SiteBuildInput } from './site_build.ts';
export { siteBuild } from './site_build.ts';
export type { CheckSummary, SiteCheckInput } from './site_check.ts';
export { siteCheck } from './site_check.ts';
export type { PlanSummary, SitePlanInput } from './site_plan.ts';
export { sitePlan } from './site_plan.ts';
export type { SiteReadInput } from './site_read.ts';
export { siteRead } from './site_read.ts';
export type { SiteWriteInput } from './site_write.ts';
export { siteWrite } from './site_write.ts';
export type {
	JsonSchema,
	ToolDef,
	ToolError,
	ToolNeedsClarification,
	ToolNoOp,
	ToolResult,
	ToolSuccess,
} from './types.ts';

import { siteBuild } from './site_build.ts';
import { siteCheck } from './site_check.ts';
import { sitePlan } from './site_plan.ts';
import { siteRead } from './site_read.ts';
import { siteWrite } from './site_write.ts';
import type { ToolDef } from './types.ts';

/** All tools in registration order. Pass to an MCP server or function-calling adapter. */
export const TOOLS: readonly ToolDef[] = [siteRead, siteWrite, siteBuild, siteCheck, sitePlan];
