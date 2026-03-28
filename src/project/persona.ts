import { isSiteError } from '../errors.ts';
import { readFile } from '../fs/read_file.ts';
import { writeFile } from '../fs/write_file.ts';

/**
 * Load PERSONA.md. Returns the raw markdown string.
 * Returns an empty string if the file does not exist yet.
 */
export async function loadPersona(filePath: string): Promise<string> {
	try {
		return await readFile(filePath);
	} catch (err) {
		if (isSiteError(err) && err.code === 'not_found') return '';
		throw err;
	}
}

export async function writePersona(filePath: string, content: string): Promise<void> {
	await writeFile(filePath, content);
}

export const PERSONA_TEMPLATE = `# Voice

## Archetype

<!-- Concrete behavioral identity, not vague adjectives.
e.g., "Experienced craftsman explaining their trade to a curious friend"
NOT "professional yet approachable" -->

## Tone Dimensions

Funny ←→ Serious: [1-5]
Formal ←→ Casual: [1-5]
Respectful ←→ Irreverent: [1-5]
Enthusiastic ←→ Matter-of-fact: [1-5]

## Vocabulary

### Preferred Terms

<!-- Words and phrases that define the brand voice -->

### Banned Terms

<!-- Words and phrases to never use -->

### Jargon Policy

<!-- Whether technical terms are OK, whether to define them on first use -->

## Sentence Style

- Target readability: [Flesch-Kincaid grade range, e.g., "8-10"]
- Contractions: [yes/no/sometimes]
- Active voice: [preferred/required/no preference]
- Sentence variety: [target burstiness — "mix short punchy with longer explanatory"]
- Addressing: [you/we/one/they — how to refer to the reader]

## Formatting

- Lists: [when to use, bullet vs. numbered]
- Bold/italic: [policy]
- Emoji: [never/sparingly/freely]
- Headers: [style — question format, statement, noun phrase]

## Examples

### Good

<!-- 2-3 short passages (50-100 words each) that nail the voice -->

### Bad

<!-- 1-2 short passages showing what to avoid -->
`;
