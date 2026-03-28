/**
 * Minimal stub for node:stream used by @jsonjoy.com/fs-node-builtins (memfs dep).
 * The stream APIs are not called at runtime in the demo.
 */
export class Readable {
	pipe() {
		return this;
	}
	on() {
		return this;
	}
	once() {
		return this;
	}
	resume() {
		return this;
	}
	destroy() {}
}

export class Writable {
	write() {
		return true;
	}
	end() {
		return this;
	}
	on() {
		return this;
	}
	once() {
		return this;
	}
	destroy() {}
}

export class Transform extends Readable {}

export class PassThrough extends Readable {}

export class Stream extends Readable {}

export default { Readable, Writable, Transform, PassThrough, Stream };
