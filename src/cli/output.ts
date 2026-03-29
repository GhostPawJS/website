/**
 * Terminal output helpers — ANSI colors + progress bar rendering.
 * Respects NO_COLOR env var and non-TTY environments.
 */

const useColor = !process.env.NO_COLOR && process.stdout.isTTY;

const esc = (code: string) => (s: string) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);

export const c = {
	bold: esc('1'),
	dim: esc('2'),
	red: esc('31'),
	green: esc('32'),
	yellow: esc('33'),
	cyan: esc('36'),
	gray: esc('90'),
};

/** Render a score (0–100) as a fixed-width block bar. */
export function bar(score: number, width = 24): string {
	const filled = Math.round((score / 100) * width);
	const empty = width - filled;
	const color = score >= 80 ? c.green : score >= 60 ? c.yellow : c.red;
	return color('█'.repeat(filled)) + c.dim('░'.repeat(empty));
}

/** Color a string based on a 0–100 score. */
export function scoreColor(score: number, s: string): string {
	if (score >= 80) return c.green(s);
	if (score >= 60) return c.yellow(s);
	return c.red(s);
}

/** Print a fatal error to stderr and exit 1. */
export function fatal(msg: string): never {
	process.stderr.write(`\n  ${c.red('Error')}  ${msg}\n\n`);
	process.exit(1);
}

/** Format milliseconds as human-readable duration. */
export function fmtMs(ms: number): string {
	if (ms < 1000) return `${ms}ms`;
	return `${(ms / 1000).toFixed(1)}s`;
}
