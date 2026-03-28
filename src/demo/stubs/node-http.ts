/**
 * Stub for node:http — no-ops since serve() is not called in the browser demo.
 *
 * Aliased in build_demo.mjs:
 *   'node:http' → this file
 */

export const createServer = () => ({
	listen() {},
	close() {},
	address() {
		return { port: 3000 };
	},
	once() {
		return this;
	},
});

export type IncomingMessage = Record<string, unknown>;
export type ServerResponse = Record<string, unknown>;

export default { createServer };
