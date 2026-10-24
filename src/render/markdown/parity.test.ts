import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { marked } from 'marked';
import ts from 'typescript';
import { markdownToHtml } from './renderer.ts';

const corpus = [
	'```\n```',
	'```\n\n```',
	'```\na\n\n\n```',
	'  ```js\n  x\n  ```',
	'` `',
	'`   `',
	'`<b>`',
	'`` ` ``',
	'<style>**raw**</style>',
	'inline <code>*raw*</code> text',
	'inline <script>*raw*</script>',
	'<custom>\n*hello*\n</custom>',
	'<div>\n\n*hello*\n\n</div>',
	'- [ ] a\n\n- [x] b',
	'- a\n\n  b\n- c',
	'- a\n  1. b\n  2. c',
	'1. a\n   - b\n2. c',
	'- a\n    code',
	'a\n| a | b |\n| --- | --- |\n| x | y |',
	'a | b\n--- | ---\nx | y',
	'https://example.com?a=1&b=2',
	'<https://example.com?a=1&b=2>',
	'[x][id]\n\n[id]: /url (a title)',
	'![a\\*b](/x)',
	'[a](url_(a(b)))',
	'![**foo** <b>bar</b>](/x)',
	'![a &amp; b](/x)',
	'  a\n b  ',
	'[a](url (title))',
	'*foo **bar** baz*',
	'**foo *bar* baz**',
	'foo_bar_baz',
	'foo__bar__baz',
	'*a **b** c*',
	'***a** b*',
	'**a *b***',
	'<script>\n\nconst x = "**raw**";\n</script>',
	'<!--\n\n**raw**\n-->',
	'<pre>\n\n**raw**\n</pre>',
	'- a\n\nparagraph',
	'- a\n  continued\n\n  paragraph\n- b',
	'a\n\n    b\n\n    c',
	'[a](foo?a=1&b=2)',
	'> a\n\n> b',
	'- a\n\n  - b\n    - c',
	'![*alt* `code`](/image)',
	'[a](<hello world>)',

	'',
	'hello',
	'one\n\ntwo',
	'# heading',
	'## heading ##',
	'### heading',
	'#### heading',
	'##### heading',
	'###### heading',
	'setext\n===',
	'setext\n---',
	'**strong**',
	'__strong__',
	'*emphasis*',
	'_emphasis_',
	'***both***',
	'one **two *three* four** five',
	'~~deleted~~',
	'~deleted~',
	'`code`',
	'``code ` tick``',
	'` a `',
	'` a  b `',
	'```\ncode\n```',
	'```ts\nconst x = "<>&";\n```',
	'~~~js\nx\n~~~',
	'    indented\n    code',
	'> quote',
	'> first\n>\n> second',
	'> # Heading\n> text',
	'> outer\n>> inner',
	'- one\n- two',
	'* one\n* two',
	'+ one\n+ two',
	'1. one\n2. two',
	'3. three\n4. four',
	'- parent\n  - child\n  - child two\n- next',
	'- [ ] pending\n- [x] done\n- [X] Done',
	'- first\n\n- second',
	'[label](https://example.com)',
	'[label](https://example.com "title")',
	'[**bold**](/path)',
	'![alt](/image.png)',
	'![alt](/image.png "title")',
	'<https://example.com>',
	'<user@example.com>',
	'https://example.com',
	'www.example.com',
	'user@example.com',
	'URL https://example.com/path.',
	'---',
	'***',
	'___',
	'a  \nb',
	'a\\\nb',
	'a\nb',
	'<span>raw</span>',
	'<div>\nraw\n</div>\n',
	'<!-- comment -->\n',
	'a & b < c > d "quoted"',
	'&amp; &copy; &#65; &#x41;',
	'`&amp; < > "`',
	'```html\n&amp; < > "\n```',
	'\\*literal\\*',
	'[ref][id]\n\n[id]: /url "title"',
	'| a | b |\n| --- | --- |\n| c | d |',
	'| a | b | c |\n| :--- | :---: | ---: |\n| d | e | f |',
	'| a | b |\n| --- | --- |',
	'# no id\n\nparagraph',
	'---\n\n# Title\n\nBody',
];

function visitFiles(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
		entry.isDirectory() ? visitFiles(join(dir, entry.name)) : [join(dir, entry.name)],
	);
}

// Include checked-in Markdown and Markdown literals from tests, demo, and templates.
for (const path of visitFiles('src').filter(
	(path) =>
		!path.includes('/markdown/') &&
		(path.endsWith('.test.ts') ||
			path.includes('/demo/') ||
			path.includes('templates') ||
			path.endsWith('/domain.ts') ||
			path.endsWith('/persona.ts')),
)) {
	if (!/\.[cm]?[jt]sx?$/.test(path)) continue;
	const source = ts.createSourceFile(
		path,
		readFileSync(path, 'utf8'),
		ts.ScriptTarget.Latest,
		true,
	);
	const visit = (node: ts.Node) => {
		if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
			const parent = node.parent;
			const call = ts.isCallExpression(parent) ? parent : undefined;
			const callee = call?.expression.getText(source) || '';
			const argument = call?.arguments.indexOf(node) ?? -1;
			const markdownArgument =
				(/(?:^|\.)renderMarkdown$|(?:^|\.)parsePageSource$/.test(callee) && argument === 0) ||
				(/(?:^|\.)writePage$/.test(callee) && argument === 3) ||
				(/(?:^|\.)writeFile$/.test(callee) &&
					argument === 1 &&
					call?.arguments[0]?.getText(source).includes('.md'));
			if (
				markdownArgument ||
				/(?:^|\n)(?:#{1,6} |[-*] |\d+\. |>|```)|\*\*[^*]+\*\*/.test(node.text)
			)
				corpus.push(node.text);
		}
		ts.forEachChild(node, visit);
	};
	visit(source);
}
for (const path of [
	...visitFiles('docs'),
	...readdirSync('.').filter((path) => path.endsWith('.md')),
]) {
	if (path.endsWith('.md')) corpus.push(readFileSync(path, 'utf8'));
}

describe('GFM parity with marked', () => {
	it('contains at least sixty examples', () => assert.ok(corpus.length >= 60));
	for (const [index, source] of corpus.entries()) {
		it(`case ${index}: ${source.slice(0, 70).replace(/\n/g, ' / ')}`, () => {
			assert.equal(markdownToHtml(source), marked.parse(source, { gfm: true, async: false }));
		});
	}
});
