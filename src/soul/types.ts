// ---------------------------------------------------------------------------
// Soul type — specialist persona for LLM agents.
// ---------------------------------------------------------------------------

/**
 * A Persona describes the identity, values, and working style of an LLM agent
 * specialised for a particular domain.  Call \`renderSoulPromptFoundation()\`
 * to get a system-prompt string ready to inject into an LLM call.
 */
export interface Persona {
	/** Stable kebab-case identifier. */
	slug: string;
	/** Display name. */
	name: string;
	/** One-sentence description of the persona's specialty. */
	description: string;
	/** The core identity statement — 2–4 sentences. */
	essence: string;
	/** Behavioural traits — each is a terse rule the agent follows. */
	traits: string[];
	/**
	 * Render a complete system prompt foundation for this persona.
	 * Inject at the top of the system prompt before task instructions.
	 */
	renderSoulPromptFoundation(): string;
}
