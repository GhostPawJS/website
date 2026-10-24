import { siteBuild } from './site_build.ts';
import { siteCheck } from './site_check.ts';
import { sitePlan } from './site_plan.ts';
import { siteRead } from './site_read.ts';
import { siteWrite } from './site_write.ts';
import type { JsonSchema, ToolDef, ToolResult } from './types.ts';

export interface WebsiteToolResult<T = unknown> {
	ok: boolean;
	outcome: 'success' | 'no_op' | 'needs_clarification' | 'error';
	summary: string;
	data?: T;
	next?: { kind: 'ask_user'; message: string }[];
	error?: { code: string; message: string };
}

export interface WebsiteToolDefinition<TInput = unknown, TData = unknown> {
	name: string;
	description: string;
	whenToUse: string;
	whenNotToUse: string;
	inputSchema: JsonSchema;
	readOnly: boolean;
	sideEffects: 'none' | 'writes_state';
	handler(dir: string, input: TInput): Promise<WebsiteToolResult<TData>>;
}

function adaptResult<T>(name: string, result: ToolResult<T>): WebsiteToolResult<T> {
	switch (result.status) {
		case 'success':
			return { ok: true, outcome: 'success', summary: `${name} completed.`, data: result.data };
		case 'no_op':
			return { ok: true, outcome: 'no_op', summary: result.message };
		case 'needs_clarification':
			return {
				ok: false,
				outcome: 'needs_clarification',
				summary: result.question,
				next: [{ kind: 'ask_user', message: result.question }],
			};
		case 'error':
			return {
				ok: false,
				outcome: 'error',
				summary: result.message,
				error: { code: result.code, message: result.message },
			};
	}
}

function adapt<TInput, TData>(tool: ToolDef<TInput, TData>): WebsiteToolDefinition<TInput, TData> {
	// Whole-site fitness calls append history, including those exposed by read/check.
	const writesState = tool.sideEffects || tool.name === 'site_read' || tool.name === 'site_check';
	return {
		name: tool.name,
		description: tool.description,
		whenToUse: tool.whenToUse,
		whenNotToUse: tool.whenNotToUse,
		inputSchema: tool.inputSchema,
		readOnly: !writesState,
		sideEffects: writesState ? 'writes_state' : 'none',
		async handler(dir, input) {
			return adaptResult(tool.name, await tool.call(dir, input));
		},
	};
}

/** Tools in registration order; handlers delegate to the original implementations. */
export const websiteTools = [
	adapt(siteRead),
	adapt(siteWrite),
	adapt(siteBuild),
	adapt(siteCheck),
	adapt(sitePlan),
] as const;

export function listWebsiteToolDefinitions() {
	return [...websiteTools];
}
type WebsiteToolMap = {
	site_read: (typeof websiteTools)[0];
	site_write: (typeof websiteTools)[1];
	site_build: (typeof websiteTools)[2];
	site_check: (typeof websiteTools)[3];
	site_plan: (typeof websiteTools)[4];
};

export function getWebsiteToolByName<K extends keyof WebsiteToolMap>(
	name: K,
): WebsiteToolMap[K] | null;
export function getWebsiteToolByName(name: string): WebsiteToolDefinition | null;
export function getWebsiteToolByName(name: string) {
	return websiteTools.find((tool) => tool.name === name) ?? null;
}
