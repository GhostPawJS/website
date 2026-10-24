/** Escape literal HTML, retaining existing character references in prose. */
function escapeHtml(text: string, entities = true): string {
	return text.replace(
		entities ? /&(?!#\d+;|#x[\da-f]+;|\w+;)|[<>"']/gi : /[&<>"']/g,
		(ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] as string,
	);
}

type Reference = { href: string; title?: string };
type References = Map<string, Reference>;

interface Delimiter {
	marker: string;
	count: number;
	original: number;
	open: boolean;
	close: boolean;
	before: string;
	after: string;
	active: boolean;
}

function resolveDelimiters(parts: (string | Delimiter)[], delimiters: Delimiter[]): string {
	for (let c = 0; c < delimiters.length; c++) {
		const closer = delimiters[c] as Delimiter;
		if (!closer.close) continue;
		for (let o = c - 1; o >= 0 && closer.count > 0; o--) {
			const opener = delimiters[o] as Delimiter;
			if (!opener.active || !opener.open || !opener.count || opener.marker !== closer.marker)
				continue;
			if (
				(opener.close || closer.open) &&
				(opener.original + closer.original) % 3 === 0 &&
				(opener.original % 3 !== 0 || closer.original % 3 !== 0)
			)
				continue;
			const count = opener.count >= 2 && closer.count >= 2 ? 2 : 1;
			const tag = count === 2 ? 'strong' : 'em';
			opener.count -= count;
			closer.count -= count;
			opener.after = `<${tag}>${opener.after}`;
			closer.before += `</${tag}>`;
			for (let n = o + 1; n < c; n++) (delimiters[n] as Delimiter).active = false;
			if (opener.count && closer.count) o++;
		}
	}
	return parts
		.map((part) =>
			typeof part === 'string' ? part : part.before + part.marker.repeat(part.count) + part.after,
		)
		.join('');
}

/** Read balanced link labels and destinations without limiting nesting depth. */
function readLink(source: string): RegExpExecArray | null {
	const image = source.startsWith('![');
	if (!image && !source.startsWith('[')) return null;
	const start = image ? 2 : 1;
	let depth = 1;
	let i = start;
	for (; i < source.length; i++) {
		if (source[i] === '\\') {
			i++;
			continue;
		}
		if (source[i] === '[') depth++;
		if (source[i] === ']' && --depth === 0) break;
	}
	if (source[i + 1] !== '(') return null;
	const label = source.slice(start, i);
	i += 2;
	while (/\s/.test(source[i] || '') && i < source.length) i++;
	const hrefStart = i;
	if (source[i] === '<') {
		i++;
		while (i < source.length && source[i] !== '>' && source[i] !== '\n') {
			if (source[i] === '\\') i++;
			i++;
		}
		if (source[i] !== '>') return null;
		i++;
	} else {
		depth = 0;
		for (; i < source.length; i++) {
			if (source[i] === '\\') {
				i++;
				continue;
			}
			if (/\s/.test(source[i] as string)) break;
			if (source[i] === '(') depth++;
			if (source[i] === ')') {
				if (!depth) break;
				depth--;
			}
		}
	}
	const href = source.slice(hrefStart, i);
	const beforeSpace = i;
	while (i < source.length && /\s/.test(source[i] as string)) i++;
	let title: string | undefined;
	if (i > beforeSpace && ['"', "'", '('].includes(source[i] || '')) {
		const closing = source[i] === '(' ? ')' : source[i];
		const titleStart = ++i;
		while (i < source.length && source[i] !== closing) {
			if (source[i] === '\\') i++;
			i++;
		}
		if (i === source.length) return null;
		title = source.slice(titleStart, i++).replace(/\\([\W_])/g, '$1');
		while (i < source.length && /\s/.test(source[i] as string)) i++;
	}
	if (source[i] !== ')') return null;
	return [
		source.slice(0, i + 1),
		image ? '!' : '',
		label,
		href,
		title,
	] as unknown as RegExpExecArray;
}

function imageAlt(label: string, refs: References): string {
	const tags: string[] = [];
	let marker = '\uE000';
	while (label.includes(marker)) marker += '\uE000';
	const protectedLabel = label.replace(/<[^>]*>/g, (tag) => {
		tags.push(tag);
		return `${marker}${tags.length - 1}${marker}`;
	});
	return inline(protectedLabel, refs, true)
		.replace(/<[^>]*>/g, '')
		.replace(new RegExp(`${marker}(\\d+)${marker}`, 'g'), (_, index: string) =>
			escapeHtml(tags[Number(index)] || ''),
		);
}

function inline(source: string, refs: References, inLink = false): string {
	const parts: (string | Delimiter)[] = [];
	const delimiters: Delimiter[] = [];
	let previous = '';
	while (source) {
		let match = [] as unknown as RegExpExecArray;
		const take = (pattern: RegExp): boolean => {
			const found = pattern.exec(source);
			if (!found) return false;
			match = found;
			return true;
		};
		if (take(/^\\([!"#$%&'()*+,\-./:;<=>?@[\]\\^_`{|}~])/)) {
			parts.push(escapeHtml(match[1] as string, false));
		} else if (take(/^(`+)([\s\S]*?[^`])\1(?!`)/)) {
			let text = (match[2] as string).replace(/\n/g, ' ');
			if (/^ .* $/.test(text) && /[^ ]/.test(text)) text = text.slice(1, -1);
			parts.push(`<code>${escapeHtml(text, false)}</code>`);
		} else if (take(/^(?: {2,}|\\)\n\s*/)) {
			parts.push('<br>');
		} else if (take(/^<((?:https?:\/\/|mailto:)[^ <>]+|[^ <>@]+@[^ <>@]+\.[^ <>@]+)>/i)) {
			const label = match[1] as string;
			const email = !label.includes('://') && !label.startsWith('mailto:');
			parts.push(
				`<a href="${encodeURI(email ? `mailto:${label}` : label).replace(/%25/g, '%')}">${escapeHtml(label)}</a>`,
			);
		} else if (take(/^(?:<!--[\s\S]*?-->|<\/?[a-zA-Z][^>]*>|<\?[\s\S]*?\?>|<![A-Z][^>]*>)/)) {
			parts.push(match[0]);
		} else if (readLink(source)) {
			match = readLink(source) as RegExpExecArray;
			const label = match[2] as string;
			const href = (match[3] as string).replace(/^<|>$/g, '').replace(/\\([\W_])/g, '$1');
			const titleText = match[4] ?? match[5] ?? match[6];
			const title = titleText === undefined ? '' : ` title="${escapeHtml(titleText)}"`;
			parts.push(
				match[1]
					? `<img src="${encodeURI(href).replace(/%25/g, '%')}" alt="${imageAlt(label, refs)}"${title}>`
					: `<a href="${encodeURI(href).replace(/%25/g, '%')}"${title}>${inline(label, refs, true)}</a>`,
			);
		} else if (
			take(/^(!?)\[([^\]]+)\](?:\[([^\]]*)\])?/) &&
			refs.has((match[3] || match[2] || '').toLowerCase().replace(/\s+/g, ' '))
		) {
			const ref = refs.get(
				(match[3] || match[2] || '').toLowerCase().replace(/\s+/g, ' '),
			) as Reference;
			const title = ref.title === undefined ? '' : ` title="${escapeHtml(ref.title)}"`;
			parts.push(
				match[1]
					? `<img src="${encodeURI(ref.href).replace(/%25/g, '%')}" alt="${imageAlt(match[2] as string, refs)}"${title}>`
					: `<a href="${encodeURI(ref.href).replace(/%25/g, '%')}"${title}>${inline(match[2] as string, refs, true)}</a>`,
			);
		} else if (take(/^[*_]+/)) {
			const marker = source[0] as string;
			const run = new RegExp(`^${marker === '*' ? '\\*' : '_'}+`).exec(source)?.[0] || marker;
			match[0] = run;
			const next = source[run.length] || '';
			const white = (ch: string) => ch === '' || /\s/u.test(ch);
			const punctuation = (ch: string) => /[\p{P}\p{S}]/u.test(ch);
			const left = !white(next) && (!punctuation(next) || white(previous) || punctuation(previous));
			const right =
				!white(previous) && (!punctuation(previous) || white(next) || punctuation(next));
			const delimiter: Delimiter = {
				marker,
				count: run.length,
				original: run.length,
				open: left && (marker === '*' || !right || punctuation(previous)),
				close: right && (marker === '*' || !left || punctuation(next)),
				before: '',
				after: '',
				active: true,
			};
			delimiters.push(delimiter);
			parts.push(delimiter);
		} else if (take(/^(~~?)(?=\S)([\s\S]*?\S|\S)\1(?!~)/)) {
			parts.push(`<del>${inline(match[2] as string, refs, inLink)}</del>`);
		} else if (!inLink && take(/^(https?:\/\/[^\s<]+|www\.[^\s<]+|[\w.+-]+@[\w.-]+\.[a-z]{2,})/i)) {
			let url = match[0].replace(/[?!.,:;*_~]+$/, '');
			while (url.endsWith(')') && (url.match(/\)/g)?.length ?? 0) > (url.match(/\(/g)?.length ?? 0))
				url = url.slice(0, -1);
			match[0] = url;
			const href = url.startsWith('www.')
				? `http://${url}`
				: url.includes('@') && !url.includes('://')
					? `mailto:${url}`
					: url;
			parts.push(`<a href="${encodeURI(href).replace(/%25/g, '%')}">${escapeHtml(url)}</a>`);
		} else {
			match = /^(?:&(?:#\d+|#x[\da-f]+|\w+);|[\s\S])/i.exec(source) as RegExpExecArray;
			parts.push(escapeHtml(match[0]));
		}
		previous = match[0].slice(-1);
		source = source.slice(match[0].length);
	}
	return resolveDelimiters(parts, delimiters);
}

function cells(line: string): string[] {
	return line
		.trim()
		.replace(/^\|/, '')
		.replace(/\|$/, '')
		.split(/(?<!\\)\|/)
		.map((cell) => cell.trim().replace(/\\\|/g, '|'));
}

function blocks(source: string, refs: References, tight = false): string {
	const lines = source.split('\n');
	let html = '';
	let i = 0;
	const startsBlock = (line: string) =>
		/^ {0,3}(?:#{1,6}(?:\s|$)|>|`{3,}|~{3,}|(?:[-*_]\s*){3,}$|[-+*] |1[.)] |<(?:div|table|script|style|pre|section|!--)\b)/.test(
			line,
		);
	while (i < lines.length) {
		const line = lines[i] as string;
		let match = [] as unknown as RegExpExecArray;
		const takeLine = (pattern: RegExp): boolean => {
			const found = pattern.exec(line);
			if (!found) return false;
			match = found;
			return true;
		};
		if (!line.trim()) {
			i++;
			continue;
		}
		if (takeLine(/^ {0,3}\[([^\]]+)\]:\s*<?([^\s>]+)>?(?:\s+["'(](.*)["')])?\s*$/)) {
			i++;
			continue;
		}
		if (takeLine(/^ {0,3}(`{3,}|~{3,})(.*)$/)) {
			const fence = match[1] as string;
			const indentation = line.length - line.trimStart().length;
			const lang = (match[2] as string).trim().split(/\s/)[0];
			const content: string[] = [];
			i++;
			while (
				i < lines.length &&
				!new RegExp(`^ {0,3}${fence[0]}{${fence.length},}\\s*$`).test(lines[i] as string)
			)
				content.push((lines[i++] as string).replace(new RegExp(`^ {0,${indentation}}`), ''));
			if (i < lines.length) i++;
			if (content.at(-1) === '') content.pop();
			html += `<pre><code${lang ? ` class="language-${escapeHtml(lang)}"` : ''}>${escapeHtml(content.join('\n'), false)}\n</code></pre>\n`;
			continue;
		}
		if (/^(?: {4}|\t)/.test(line)) {
			const content: string[] = [];
			while (
				i < lines.length &&
				(/^(?: {4}|\t)/.test(lines[i] as string) || !(lines[i] as string).trim())
			)
				content.push((lines[i++] as string).replace(/^(?: {4}|\t)/, ''));
			while (content.at(-1) === '') content.pop();
			html += `<pre><code>${escapeHtml(content.join('\n'), false)}\n</code></pre>\n`;
			continue;
		}
		if (takeLine(/^ {0,3}(#{1,6})(?:[ \t]+(.*)|$)/)) {
			const level = (match[1] as string).length;
			html += `<h${level}>${inline((match[2] || '').replace(/\s+#+\s*$/, ''), refs)}</h${level}>\n`;
			i++;
			continue;
		}
		if (/^ {0,3}(?:(?:\*\s*){3,}|(?:-\s*){3,}|(?:_\s*){3,})$/.test(line)) {
			html += '<hr>\n';
			i++;
			continue;
		}
		if (/^ {0,3}>/.test(line)) {
			const content: string[] = [];
			while (
				i < lines.length &&
				(lines[i] as string).trim() &&
				(!startsBlock(lines[i] as string) || /^ {0,3}>/.test(lines[i] as string))
			)
				content.push((lines[i++] as string).replace(/^ {0,3}> ?/, ''));
			html += `<blockquote>\n${blocks(content.join('\n'), refs)}</blockquote>\n`;
			continue;
		}
		if (takeLine(/^( {0,3})([-+*]|\d{1,9}[.)]) +(.*)$/)) {
			const ordered = /\d/.test(match[2] as string);
			const baseIndent = (match[1] as string).length;
			const marker = ordered ? (match[2] as string).slice(-1) : match[2];
			const start = parseInt(match[2] as string, 10);
			const items: string[] = [];
			let loose = false;
			while (i < lines.length) {
				const item = /^( *)([-+*]|\d{1,9}[.)]) +(.*)$/.exec(lines[i] as string);
				if (
					!item ||
					(item[1] as string).length !== baseIndent ||
					(ordered ? (item[2] as string).slice(-1) : item[2]) !== marker
				)
					break;
				const indent = (item[0] as string).length - (item[3] as string).length;
				const content = [item[3] as string];
				i++;
				while (i < lines.length) {
					const next = lines[i] as string;
					if (!next.trim()) {
						if (
							i + 1 < lines.length &&
							(/^\s+\S/.test(lines[i + 1] as string) ||
								/^( *)([-+*]|\d+[.)]) /.test(lines[i + 1] as string))
						) {
							content.push('');
							loose = true;
							i++;
							continue;
						}
						break;
					}
					if ((next.match(/^\s*/)?.[0].length ?? 0) >= indent) {
						content.push(next.slice(indent));
						i++;
					} else if (!startsBlock(next) && !/^( *)([-+*]|\d+[.)]) /.test(next)) {
						content.push(next);
						i++;
					} else break;
				}
				items.push(content.join('\n').trimEnd());
			}
			const tag = ordered ? 'ol' : 'ul';
			html += `<${tag}${ordered && start !== 1 ? ` start="${start}"` : ''}>\n`;
			for (let item of items) {
				const task = /^\[([ xX])\] /.exec(item);
				if (task) item = item.slice(4);
				let body = blocks(item, refs, !loose);
				if (task) {
					const checkbox = `<input${task[1] !== ' ' ? ' checked=""' : ''} disabled="" type="checkbox"> `;
					body = loose ? body.replace(/^<p>/, `<p>${checkbox}`) : checkbox + body;
				}
				html += `<li>${loose || /<\/(?:ul|ol)>\n$/.test(body) ? body : body.replace(/\n$/, '')}</li>\n`;
			}
			html += `</${tag}>\n`;
			continue;
		}
		if (
			/^ {0,3}<\/?[A-Za-z][A-Za-z0-9-]*(?:[ \t]+[^<>]*|\/?)>\s*$/.test(line) &&
			!/^ {0,3}<(script|pre|style|textarea)(?:\s|>)/i.test(line)
		) {
			const content: string[] = [];
			while (i < lines.length && (lines[i] as string).trim()) content.push(lines[i++] as string);
			if (i < lines.length && lines[i] === '') {
				content.push('');
				i++;
			}
			while (i < lines.length && lines[i] === '') {
				content.push('');
				i++;
			}
			html += content.join('\n') + (i < lines.length ? '\n' : '');
			continue;
		}
		const raw = /^ {0,3}<(script|pre|style|textarea)(?:\s|>)/i.exec(line);
		if (raw || /^ {0,3}<!--/.test(line)) {
			const closing = raw ? new RegExp(`</${raw[1]}>`, 'i') : /-->/;
			const content: string[] = [];
			do {
				content.push(lines[i++] as string);
			} while (i < lines.length && !closing.test(content.at(-1) || ''));
			while (i < lines.length && lines[i] === '') {
				content.push('');
				i++;
			}
			html += content.join('\n') + (i < lines.length ? '\n' : '');
			continue;
		}
		if (
			/^ {0,3}<(?:!--|\/?(?:address|article|aside|base|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|nav|ol|p|pre|script|section|source|style|summary|table|tbody|td|th|thead|title|tr|ul)(?:\s|>|\/))/.test(
				line,
			)
		) {
			const content: string[] = [];
			while (i < lines.length && (lines[i] as string).trim()) content.push(lines[i++] as string);
			while (i < lines.length && lines[i] === '') {
				content.push('');
				i++;
			}
			html += content.join('\n') + (i < lines.length ? '\n' : '');
			continue;
		}
		if (
			i + 1 < lines.length &&
			/\|/.test(line) &&
			/^\s*\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?\s*$/.test(lines[i + 1] as string)
		) {
			const header = cells(line);
			const align = cells(lines[i + 1] as string).map((cell) =>
				cell.startsWith(':') && cell.endsWith(':')
					? 'center'
					: cell.endsWith(':')
						? 'right'
						: cell.startsWith(':')
							? 'left'
							: '',
			);
			if (header.length === align.length) {
				const row = (values: string[], tag: string) =>
					`<tr>\n${header.map((_, n) => `<${tag}${align[n] ? ` align="${align[n]}"` : ''}>${inline(values[n] || '', refs)}</${tag}>\n`).join('')}</tr>\n`;
				html += `<table>\n<thead>\n${row(header, 'th')}</thead>\n`;
				i += 2;
				if (i < lines.length && /\|/.test(lines[i] as string) && (lines[i] as string).trim()) {
					html += '<tbody>';
					while (i < lines.length && /\|/.test(lines[i] as string) && (lines[i] as string).trim())
						html += row(cells(lines[i++] as string), 'td');
					html += '</tbody>';
				}
				html += '</table>\n';
				continue;
			}
		}
		const paragraph = [line];
		i++;
		let heading = 0;
		while (i < lines.length && (lines[i] as string).trim()) {
			if (/^ {0,3}(=+|-+)\s*$/.test(lines[i] as string)) {
				heading = (lines[i] as string).trim()[0] === '=' ? 1 : 2;
				i++;
				break;
			}
			if (startsBlock(lines[i] as string)) break;
			if (
				i + 1 < lines.length &&
				/\|/.test(lines[i] as string) &&
				/^\s*\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?\s*$/.test(lines[i + 1] as string)
			)
				break;
			paragraph.push(lines[i++] as string);
		}
		const text = inline(paragraph.join('\n'), refs);
		html += heading ? `<h${heading}>${text}</h${heading}>\n` : tight ? text : `<p>${text}</p>\n`;
	}
	return html;
}

/** Render the supported CommonMark and GFM block and inline constructs. */
export function markdownToHtml(source: string): string {
	source = source.replace(/\r\n?/g, '\n');
	const refs: References = new Map();
	for (const match of source.matchAll(
		/^ {0,3}\[([^\]]+)\]:\s*<?([^\s>]+)>?(?:\s+["'(](.*)["')])?\s*$/gm,
	)) {
		const ref: Reference = { href: match[2] as string };
		if (match[3] !== undefined) ref.title = match[3];
		refs.set((match[1] as string).toLowerCase().replace(/\s+/g, ' '), ref);
	}
	return blocks(source, refs);
}
