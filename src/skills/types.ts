// ---------------------------------------------------------------------------
// Skill type — procedural playbook for LLM agents.
// ---------------------------------------------------------------------------

/**
 * A Skill is a named, reusable playbook written in plain markdown.
 * Agents inject the `content` string into their system prompt or reference
 * it as a multi-shot example when performing a specific task category.
 */
export interface Skill {
	/** Stable kebab-case identifier. */
	name: string;
	/** One-sentence summary for skill selection. */
	description: string;
	/** When the agent should apply this skill. */
	whenToUse: string;
	/** The full markdown playbook. */
	content: string;
}
