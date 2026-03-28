export type SiteErrorCode = 'not_found' | 'validation' | 'io' | 'build' | 'conflict';

export class SiteError extends Error {
	readonly code: SiteErrorCode;

	constructor(code: SiteErrorCode, message: string) {
		super(message);
		this.name = 'SiteError';
		this.code = code;
	}
}

export function isSiteError(value: unknown): value is SiteError {
	return value instanceof SiteError;
}
