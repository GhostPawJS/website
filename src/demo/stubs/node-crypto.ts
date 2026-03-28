/**
 * Stub for node:crypto — implements createHash with a simple FNV-1a hash.
 *
 * The production code only calls:
 *   createHash('sha256').update(buf).digest('hex')
 *
 * Aliased in build_demo.mjs:
 *   'node:crypto' → this file
 */

function fnv1a(data: string | Uint8Array): string {
	let hash = 0x811c9dc5;
	const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
	for (const byte of bytes) {
		hash ^= byte;
		hash = Math.imul(hash, 0x01000193) >>> 0;
	}
	return hash.toString(16).padStart(8, '0').repeat(8).slice(0, 64);
}

export function createHash(_algorithm: string) {
	let accumulated = '';
	return {
		update(data: string | Buffer) {
			accumulated +=
				typeof data === 'string'
					? data
					: String.fromCharCode(...new Uint8Array(data as ArrayBuffer));
			return this;
		},
		digest(_enc: string): string {
			return fnv1a(accumulated);
		},
	};
}

export default { createHash };
