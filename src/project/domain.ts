import { isSiteError } from '../errors.ts';
import { readFile } from '../fs/read_file.ts';
import { writeFile } from '../fs/write_file.ts';

/**
 * Load DOMAIN.md. Returns the raw markdown string.
 * Returns an empty string if the file does not exist yet.
 */
export async function loadDomain(filePath: string): Promise<string> {
	try {
		return await readFile(filePath);
	} catch (err) {
		if (isSiteError(err) && err.code === 'not_found') return '';
		throw err;
	}
}

export async function writeDomain(filePath: string, content: string): Promise<void> {
	await writeFile(filePath, content);
}

export const DOMAIN_TEMPLATE = `# Domain

## What is this website about?

<!-- Describe the core topic, industry, and niche. -->

## Who is it for?

<!-- Describe the target audience, their problems, and their goals. -->

## What is the value proposition?

<!-- Explain why this site exists and what it uniquely offers. -->

## What are the main content areas?

<!-- List topics, sections, and content types. -->

## What distinguishes it?

<!-- Describe the competitive angle, unique perspective, or expertise. -->

## What is the primary action?

<!-- What should visitors do: buy, contact, subscribe, learn? -->
`;
