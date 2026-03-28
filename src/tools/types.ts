// ---------------------------------------------------------------------------
// Tool layer public types.
//
// ToolResult<T> — discriminated union returned by every tool.
// ToolDef       — describes a callable tool for LLM function-calling schemas.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// ToolResult
// ---------------------------------------------------------------------------

/** Tool succeeded and returned a value. */
export interface ToolSuccess<T> {
	status: 'success';
	data: T;
}

/**
 * Tool ran but nothing changed (idempotent operation where the desired
 * state already existed).
 */
export interface ToolNoOp {
	status: 'no_op';
	message: string;
}

/**
 * Tool cannot proceed without more information.
 * The `question` field is a plain-English prompt the LLM should relay to the
 * user or resolve before retrying.
 */
export interface ToolNeedsClarification {
	status: 'needs_clarification';
	question: string;
}

/** Tool encountered a hard error. */
export interface ToolError {
	status: 'error';
	code: string;
	message: string;
}

export type ToolResult<T = unknown> =
	| ToolSuccess<T>
	| ToolNoOp
	| ToolNeedsClarification
	| ToolError;

// ---------------------------------------------------------------------------
// ToolDef
// ---------------------------------------------------------------------------

/** JSON Schema object shape (permissive, sufficient for function-calling). */
export interface JsonSchema {
	type: string;
	description?: string;
	properties?: Record<string, JsonSchema>;
	items?: JsonSchema;
	required?: string[];
	enum?: unknown[];
	[key: string]: unknown;
}

/**
 * Describes a callable tool for LLM function-calling / MCP registration.
 * The `call` signature accepts a plain object so schemas can be validated
 * externally before dispatch.
 *
 * Use `ToolDef` (no type args) for heterogeneous registries — the defaults
 * use `unknown` so any concrete tool assignes safely.
 */
export interface ToolDef<TInput = unknown, TOutput = unknown> {
	/** Stable machine identifier (snake_case). */
	name: string;
	/** One-sentence description for LLM tool selection. */
	description: string;
	/** Conditions under which the LLM should reach for this tool. */
	whenToUse: string;
	/** Conditions under which the LLM should NOT use this tool. */
	whenNotToUse: string;
	/** JSON Schema for the input object. */
	inputSchema: JsonSchema;
	/** Whether this tool writes to disk or external state. */
	sideEffects: boolean;
	/** Execute the tool. `dir` is the project root. */
	call(dir: string, input: TInput): Promise<ToolResult<TOutput>>;
}
