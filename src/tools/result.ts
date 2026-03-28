// ---------------------------------------------------------------------------
// ToolResult factory helpers — keep call sites lean.
// ---------------------------------------------------------------------------

import type { ToolError, ToolNeedsClarification, ToolNoOp, ToolSuccess } from './types.ts';

export function ok<T>(data: T): ToolSuccess<T> {
	return { status: 'success', data };
}

export function noOp(message: string): ToolNoOp {
	return { status: 'no_op', message };
}

export function needsClarification(question: string): ToolNeedsClarification {
	return { status: 'needs_clarification', question };
}

export function toolError(code: string, message: string): ToolError {
	return { status: 'error', code, message };
}

/** Wrap any thrown value into a ToolError. Preserves SiteError codes. */
export function catchToError(err: unknown): ToolError {
	if (err instanceof Error) {
		const code = (err as Error & { code?: string }).code ?? 'unknown';
		return toolError(code, err.message);
	}
	return toolError('unknown', String(err));
}
