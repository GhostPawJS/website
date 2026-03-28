#!/usr/bin/env node

/**
 * Bundles the browser demo into demo/index.html.
 *
 * Node shims:
 *   node:fs/promises  → src/demo/stubs/node-fs-promises.ts  (memfs volume)
 *   node:fs           → src/demo/stubs/node-fs.ts            (memfs + no-op watch)
 *   node:crypto       → src/demo/stubs/node-crypto.ts        (FNV-1a hash stub)
 *   node:http         → src/demo/stubs/node-http.ts          (no-op server)
 *
 * Output: demo/app.js + demo/index.html (self-contained, no server needed)
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, context } from 'esbuild';

const WATCH = process.argv.includes('--watch');
const ROOT = resolve(fileURLToPath(import.meta.url), '..', '..');
const OUT_DIR = join(ROOT, 'demo');
const ENTRY = join(ROOT, 'src', 'demo', 'main.tsx');

const stub = (name) => join(ROOT, 'src', 'demo', 'stubs', name);

await mkdir(OUT_DIR, { recursive: true });

// Write HTML once (it doesn't change between rebuilds)
await writeFile(join(OUT_DIR, 'index.html'), buildHtml());

const buildOptions = {
	entryPoints: [ENTRY],
	inject: [stub('globals.ts')],
	outdir: OUT_DIR,
	bundle: true,
	format: 'esm',
	platform: 'browser',
	target: ['es2022'],
	sourcemap: true,
	jsx: 'automatic',
	jsxImportSource: 'preact',
	entryNames: 'app',
	alias: {
		// Our custom stubs (virtual filesystem + no-ops)
		'node:fs/promises': stub('node-fs-promises.ts'),
		'node:fs': stub('node-fs.ts'),
		'node:crypto': stub('node-crypto.ts'),
		'node:http': stub('node-http.ts'),
		'node:stream': stub('node-stream.ts'),
		// npm polyfills for node builtins used by memfs/fs-node-builtins
		'node:path': 'path-browserify',
		'node:buffer': 'buffer',
		'node:events': 'events',
		// Non-prefixed aliases (some packages use these forms)
		path: 'path-browserify',
	},
	// node:path and node:os are handled by esbuild's browser platform
	define: {
		'process.env.NODE_ENV': '"production"',
		'process.platform': '"browser"',
		global: 'globalThis',
	},
	logLevel: 'info',
};

if (WATCH) {
	const ctx = await context(buildOptions);
	await ctx.watch();
	console.log('\n✓ Demo watching for changes…');
} else {
	await build(buildOptions);
	console.log('\n✓ Demo built → demo/index.html');
}

function buildHtml() {
	return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>@ghostpaw/website — Interactive Demo</title>
  <style>
    /* ============================================================
       TOKENS
    ============================================================ */
    :root {
      --bg:          #06080f;
      --bg1:         #0b0e18;
      --bg2:         #10141f;
      --bg3:         #161c2c;
      --border:      #1e2840;
      --border-hi:   #2e3d5a;
      --text:        #d8e4f8;
      --text2:       #7d93b4;
      --text3:       #4a5a72;
      --cyan:        #00d4ff;
      --cyan-glow:   rgba(0,212,255,0.18);
      --cyan-dim:    rgba(0,212,255,0.08);
      --green:       #3dffa0;
      --green-glow:  rgba(61,255,160,0.18);
      --magenta:     #ff2d78;
      --magenta-glow:rgba(255,45,120,0.18);
      --amber:       #ffb340;
      --amber-glow:  rgba(255,179,64,0.18);
      --purple:      #c080ff;
      --purple-glow: rgba(192,128,255,0.18);
      --radius:      8px;
      --radius-sm:   5px;
      --mono:        'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'Consolas', ui-monospace, monospace;
      --sans:        system-ui, -apple-system, 'Segoe UI', sans-serif;
      --header-h:    46px;
      --panel-w:     440px;
    }

    /* ============================================================
       RESET
    ============================================================ */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { height: 100%; overflow: hidden; background: var(--bg); color: var(--text); }
    body { font-family: var(--sans); font-size: 13.5px; line-height: 1.5; }
    button { cursor: pointer; font-family: inherit; font-size: inherit; }
    pre, code, textarea { font-family: var(--mono); }
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: var(--bg); }
    ::-webkit-scrollbar-thumb { background: var(--border-hi); border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: var(--text3); }

    /* ============================================================
       DOT-GRID BACKGROUND
    ============================================================ */
    body::before {
      content: '';
      position: fixed; inset: 0; z-index: 0; pointer-events: none;
      background-image: radial-gradient(circle, var(--border) 1px, transparent 1px);
      background-size: 28px 28px;
      opacity: 0.45;
    }

    /* ============================================================
       BOOT SCREEN
    ============================================================ */
    .boot-screen {
      position: relative; z-index: 1;
      height: 100vh;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      gap: 2rem;
    }
    .boot-logo {
      font-family: var(--mono);
      font-size: clamp(1.2rem, 4vw, 1.8rem);
      font-weight: 700;
      letter-spacing: -0.01em;
      display: flex; gap: 0.15em; align-items: center;
    }
    .boot-logo-bracket { color: var(--text3); }
    .boot-logo-text  { color: var(--text); }
    .boot-logo-slash { color: var(--cyan); padding: 0 0.1em; }
    .boot-logo-pkg   { color: var(--cyan); text-shadow: 0 0 18px var(--cyan-glow); }
    .boot-logo-bracket.error { color: var(--magenta); }
    .boot-terminal {
      background: var(--bg1);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 1.25rem 1.5rem;
      min-width: min(480px, 90vw);
      display: flex; flex-direction: column; gap: 0.45rem;
      box-shadow: 0 0 40px rgba(0,0,0,0.6), inset 0 1px 0 var(--border-hi);
    }
    .boot-line {
      font-family: var(--mono);
      font-size: 0.8rem;
      display: flex; align-items: center; gap: 0.6em;
      color: var(--text2);
    }
    .boot-line.done { color: var(--text3); }
    .boot-line.active { color: var(--green); }
    .boot-prompt { color: var(--cyan); flex-shrink: 0; }
    .boot-cursor {
      display: inline-block;
      color: var(--cyan);
      animation: blink 1s step-end infinite;
    }
    @keyframes blink { 0%,100% { opacity:1; } 50% { opacity:0; } }
    .boot-error {
      font-family: var(--mono); font-size: 0.78rem;
      background: rgba(255,45,120,0.08);
      border: 1px solid var(--magenta);
      border-radius: var(--radius-sm);
      padding: 1rem 1.25rem;
      color: #ff6b9d;
      max-width: min(580px, 90vw);
      white-space: pre-wrap; word-break: break-word;
    }

    /* ============================================================
       APP SHELL
    ============================================================ */
    .app {
      position: relative; z-index: 1;
      height: 100vh; display: flex; flex-direction: column;
    }

    /* ============================================================
       HEADER
    ============================================================ */
    .app-header {
      flex-shrink: 0;
      height: var(--header-h);
      background: var(--bg1);
      border-bottom: 1px solid var(--border);
      padding: 0 1rem;
      display: flex; align-items: center; gap: 1rem;
      position: relative; z-index: 10;
      box-shadow: 0 1px 0 var(--border-hi), 0 2px 16px rgba(0,0,0,0.4);
    }
    .app-header-left { display: flex; align-items: center; gap: 0.6rem; flex-shrink: 0; }
    .app-header-center {
      flex: 1;
      display: flex; align-items: center; gap: 0.75rem;
      min-width: 0;
    }
    .app-header-right { display: flex; align-items: center; gap: 0.75rem; flex-shrink: 0; }

    .app-brand {
      font-family: var(--mono);
      font-size: 0.88rem; font-weight: 700;
      display: flex; align-items: center; gap: 0.05em;
    }
    .brand-bracket { color: var(--text3); }
    .brand-pkg { color: var(--cyan); text-shadow: 0 0 12px var(--cyan-glow); }
    .app-divider { color: var(--text3); }
    .app-tagline { font-size: 0.75rem; color: var(--text3); letter-spacing: 0.04em; }

    .app-progress {
      flex: 1; max-width: 180px;
      height: 3px; background: var(--bg3); border-radius: 2px; overflow: hidden;
    }
    .progress-bar {
      height: 100%; background: var(--cyan);
      box-shadow: 0 0 8px var(--cyan);
      border-radius: 2px;
      transition: width 0.4s cubic-bezier(0.4,0,0.2,1);
    }
    .app-progress-label { font-size: 0.72rem; color: var(--text3); white-space: nowrap; }

    .rebuilding-badge {
      display: flex; align-items: center; gap: 0.35rem;
      font-size: 0.72rem; color: var(--amber);
      background: var(--amber-glow);
      border: 1px solid rgba(255,179,64,0.3);
      border-radius: 999px; padding: 0.15rem 0.55rem;
    }
    .rebuilding-dot {
      width: 6px; height: 6px; border-radius: 50%;
      background: var(--amber);
      animation: pulse-dot 0.9s ease-in-out infinite;
    }
    @keyframes pulse-dot { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.4);opacity:0.7} }

    /* Panel toggle — only visible on narrow screens */
    .panel-toggle {
      display: none;
      background: var(--bg3); border: 1px solid var(--border);
      border-radius: var(--radius-sm); padding: 2px; gap: 2px;
    }
    .panel-toggle-btn {
      background: none; border: none; border-radius: 3px;
      padding: 0.2rem 0.65rem; font-size: 0.75rem; font-weight: 600;
      color: var(--text2); transition: all 0.15s;
    }
    .panel-toggle-btn.active {
      background: var(--bg1); color: var(--cyan);
      box-shadow: 0 0 8px var(--cyan-dim);
    }

    /* ============================================================
       BODY + SPLIT PANELS
    ============================================================ */
    .app-body {
      flex: 1; display: flex; overflow: hidden; position: relative;
    }
    .panel-divider {
      flex-shrink: 0; width: 1px;
      background: linear-gradient(to bottom, transparent, var(--border) 15%, var(--border) 85%, transparent);
    }

    /* On mobile, panels stack and only one is visible at a time */
    @media (max-width: 860px) {
      .panel-toggle { display: flex; }
      .app-tagline { display: none; }
      .app-progress { max-width: 100px; }
      .panel-divider { display: none; }
      .tool-panel, .preview-panel {
        position: absolute; inset: 0; z-index: 1;
        transition: transform 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.3s;
      }
      .panel-hidden {
        transform: translateX(-100%); opacity: 0; pointer-events: none;
      }
      .preview-panel.panel-hidden {
        transform: translateX(100%);
      }
    }

    /* ============================================================
       TOOL PANEL
    ============================================================ */
    .tool-panel {
      width: var(--panel-w); flex-shrink: 0;
      background: var(--bg);
      display: flex; flex-direction: column; overflow: hidden;
      min-height: 0;
    }

    /* Intro section */
    .tool-panel-intro {
      flex-shrink: 0;
      border-bottom: 1px solid var(--border);
      padding: 0.85rem 1rem;
      background: var(--bg1);
    }
    .intro-title {
      font-size: 0.65rem; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.1em;
      color: var(--text3); margin-bottom: 0.5rem;
    }
    .intro-text {
      font-size: 0.78rem; color: var(--text2); line-height: 1.55;
    }
    .intro-text code {
      color: var(--cyan); font-size: 0.73rem;
      background: var(--cyan-dim); border-radius: 3px;
      padding: 0.05em 0.3em;
    }
    .intro-text strong { color: var(--text); font-weight: 600; }
    .intro-legend {
      display: flex; flex-wrap: wrap; gap: 0.35rem; margin-top: 0.6rem;
    }
    .legend-item {
      font-family: var(--mono);
      font-size: 0.65rem; font-weight: 600;
      color: var(--tc, #888);
      background: color-mix(in srgb, var(--tc, #888) 10%, transparent);
      border: 1px solid color-mix(in srgb, var(--tc, #888) 25%, transparent);
      border-radius: 999px; padding: 0.1rem 0.45rem;
    }

    .step-list {
      flex: 1; overflow-y: auto; overflow-x: hidden;
      padding: 0.6rem; display: flex; flex-direction: column; gap: 0.45rem;
    }

    /* ============================================================
       STEP CARD
    ============================================================ */
    .step-card {
      background: var(--bg2);
      border: 1px solid var(--border);
      border-left: 3px solid var(--tc, var(--border));
      border-radius: var(--radius);
      overflow: visible;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .step-card:hover {
      border-color: color-mix(in srgb, var(--tc, #888) 40%, var(--border));
      box-shadow: 0 0 0 1px color-mix(in srgb, var(--tc, #888) 10%, transparent) inset,
                  0 4px 16px rgba(0,0,0,0.3);
    }
    .step-card.step-success {
      box-shadow: 0 0 0 1px color-mix(in srgb, var(--tc, #888) 20%, transparent) inset;
    }
    .step-card.step-error {
      border-left-color: var(--magenta);
      box-shadow: 0 0 12px var(--magenta-glow);
    }

    .step-header {
      padding: 0.55rem 0.75rem;
      display: flex; align-items: center; gap: 0.5rem;
      border-bottom: 1px solid var(--border);
    }
    .step-num {
      font-family: var(--mono); font-size: 0.65rem; font-weight: 700;
      color: var(--tc, var(--text3));
      opacity: 0.8; flex-shrink: 0;
      width: 1.6em; text-align: right;
    }
    .step-title {
      flex: 1; font-size: 0.82rem; font-weight: 600;
      color: var(--text); line-height: 1.3;
    }

    /* Tool badge + tooltip */
    .tooltip-wrap {
      position: relative; display: inline-flex;
    }
    .tool-badge {
      font-family: var(--mono);
      font-size: 0.6rem; font-weight: 700; letter-spacing: 0.03em;
      color: var(--tc, #888);
      background: color-mix(in srgb, var(--tc, #888) 12%, transparent);
      border: 1px solid color-mix(in srgb, var(--tc, #888) 28%, transparent);
      border-radius: 999px; padding: 0.12rem 0.4rem;
      cursor: default; white-space: nowrap;
      transition: box-shadow 0.15s;
    }
    .tooltip-wrap:hover .tool-badge {
      box-shadow: 0 0 8px var(--tg, transparent);
    }
    .tooltip-popup {
      position: absolute; bottom: calc(100% + 6px); right: 0;
      background: var(--bg3); border: 1px solid var(--border-hi);
      border-radius: var(--radius-sm);
      padding: 0.45rem 0.65rem;
      font-size: 0.72rem; color: var(--text2); line-height: 1.45;
      max-width: 260px; white-space: normal;
      box-shadow: 0 4px 20px rgba(0,0,0,0.5);
      z-index: 50; pointer-events: none;
      opacity: 0; transform: translateY(3px);
      transition: opacity 0.12s ease, transform 0.12s ease;
    }
    .tooltip-wrap:hover .tooltip-popup {
      opacity: 1; transform: translateY(0);
    }

    .step-status-dot {
      width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0;
    }
    .dot-ok  { background: var(--green); box-shadow: 0 0 6px var(--green-glow); }
    .dot-err { background: var(--magenta); box-shadow: 0 0 6px var(--magenta-glow); }
    .dot-warn{ background: var(--amber); box-shadow: 0 0 6px var(--amber-glow); }

    .step-desc {
      padding: 0.45rem 0.75rem;
      font-size: 0.77rem; color: var(--text2); line-height: 1.5;
      border-bottom: 1px solid var(--border);
    }

    /* JSON input area */
    .step-input-wrap {
      padding: 0.45rem 0.5rem;
    }
    .step-input-label {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 0.3rem;
      font-size: 0.62rem; font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.08em; color: var(--text3);
    }
    .json-input {
      display: block; width: 100%;
      background: var(--bg1);
      color: #88cfff;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      padding: 0.4rem 0.5rem;
      font-size: 0.72rem; line-height: 1.6;
      resize: vertical; outline: none;
      transition: border-color 0.15s, box-shadow 0.15s;
      min-height: 60px;
    }
    .json-input:focus {
      border-color: var(--tc, var(--cyan));
      box-shadow: 0 0 0 2px color-mix(in srgb, var(--tc, var(--cyan)) 12%, transparent);
    }
    .json-input.json-invalid { border-color: var(--magenta); }
    .json-error-bar {
      margin-top: 0.3rem; padding: 0.25rem 0.4rem;
      background: rgba(255,45,120,0.1); border-left: 2px solid var(--magenta);
      border-radius: 0 3px 3px 0;
      font-size: 0.7rem; color: #ff6b9d;
    }

    /* Copy button */
    .copy-btn {
      background: none; border: 1px solid var(--border); border-radius: 3px;
      color: var(--text3); font-size: 0.7rem; padding: 0.1rem 0.35rem;
      transition: all 0.15s; line-height: 1;
    }
    .copy-btn:hover { border-color: var(--border-hi); color: var(--text); }

    /* Run button + footer */
    .step-footer {
      padding: 0.45rem 0.5rem;
      display: flex; align-items: center; gap: 0.4rem;
      border-top: 1px solid var(--border);
    }
    .run-btn {
      display: flex; align-items: center; gap: 0.4em;
      background: color-mix(in srgb, var(--tc, var(--cyan)) 15%, var(--bg3));
      color: var(--tc, var(--cyan));
      border: 1px solid color-mix(in srgb, var(--tc, var(--cyan)) 30%, transparent);
      border-radius: var(--radius-sm);
      padding: 0.32rem 0.8rem;
      font-size: 0.78rem; font-weight: 700; letter-spacing: 0.02em;
      transition: all 0.15s;
    }
    .run-btn:hover:not(:disabled) {
      background: color-mix(in srgb, var(--tc, var(--cyan)) 22%, var(--bg3));
      box-shadow: 0 0 12px var(--tg, transparent);
    }
    .run-btn:disabled { opacity: 0.45; cursor: default; }
    .run-spinner {
      width: 10px; height: 10px; border-radius: 50%;
      border: 2px solid color-mix(in srgb, var(--tc, var(--cyan)) 30%, transparent);
      border-top-color: var(--tc, var(--cyan));
      animation: spin 0.7s linear infinite; display: inline-block;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .result-toggle {
      background: none; border: 1px solid var(--border); border-radius: var(--radius-sm);
      color: var(--text3); padding: 0.3rem 0.6rem; font-size: 0.73rem;
      display: flex; align-items: center; gap: 0.35em;
      transition: all 0.15s;
    }
    .result-toggle:hover { border-color: var(--border-hi); color: var(--text); }
    .result-status-label {
      font-family: var(--mono); font-size: 0.62rem; font-weight: 700;
      padding: 0.05rem 0.3rem; border-radius: 3px;
    }
    .result-status-label.ok   { color: var(--green); background: rgba(61,255,160,0.1); }
    .result-status-label.err  { color: var(--magenta); background: rgba(255,45,120,0.1); }

    /* Result JSON */
    .step-result {
      border-top: 1px solid var(--border);
      background: var(--bg1);
      overflow: hidden;
    }
    .result-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 0.3rem 0.6rem;
      border-bottom: 1px solid var(--border);
      font-size: 0.62rem; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.08em; color: var(--text3);
    }
    .result-json {
      max-height: 280px; overflow-y: auto;
      padding: 0.6rem 0.75rem;
      font-size: 0.7rem; line-height: 1.6;
      color: var(--text2);
      white-space: pre-wrap; word-break: break-all;
    }

    /* ============================================================
       PREVIEW PANEL
    ============================================================ */
    .preview-panel {
      flex: 1; display: flex; flex-direction: column;
      background: #fff; overflow: hidden;
      min-width: 0;
      min-height: 0;
    }

    /* Browser chrome */
    .browser-chrome {
      flex-shrink: 0;
      background: #1e2028; border-bottom: 1px solid #2e3040;
      padding: 0 0.75rem;
      height: 38px; display: flex; align-items: center; gap: 0.75rem;
    }
    .browser-controls { display: flex; gap: 5px; }
    .browser-dot {
      width: 11px; height: 11px; border-radius: 50%; flex-shrink: 0;
    }
    .dot-close { background: #ff5f57; }
    .dot-min   { background: #febc2e; }
    .dot-max   { background: #28c840; }
    .browser-address {
      flex: 1; min-width: 0;
      background: #13151c; border: 1px solid #2e3040;
      border-radius: 5px; padding: 0.22rem 0.6rem;
      font-family: var(--mono); font-size: 0.72rem;
      display: flex; align-items: center; gap: 0;
      overflow: hidden; white-space: nowrap;
    }
    .address-scheme { color: #4e6070; }
    .address-host   { color: #7ea7c0; }
    .address-path   { color: #bdd8f0; font-weight: 600; }
    .browser-controls-right { flex-shrink: 0; }
    .browser-badge {
      font-family: var(--mono);
      font-size: 0.6rem; font-weight: 700; text-transform: uppercase;
      color: var(--cyan); background: var(--cyan-dim);
      border: 1px solid rgba(0,212,255,0.22);
      border-radius: 999px; padding: 0.1rem 0.4rem;
    }

    /* Page tabs */
    .preview-tabs {
      flex-shrink: 0;
      background: #f4f5f7; border-bottom: 1px solid #d8dce4;
      display: flex; overflow-x: auto; padding: 0 0.4rem;
      scrollbar-width: none;
    }
    .preview-tabs::-webkit-scrollbar { display: none; }
    .preview-tab {
      padding: 0.48rem 0.75rem;
      font-family: var(--mono); font-size: 0.72rem; font-weight: 500;
      background: none; border: none;
      border-bottom: 2px solid transparent; color: #5a6478;
      white-space: nowrap; transition: color 0.12s, border-color 0.12s;
      flex-shrink: 0;
    }
    .preview-tab:hover { color: #1a1f2e; }
    .tab-active {
      color: #0f4dc4; border-bottom-color: #0f4dc4; font-weight: 700;
    }

    .preview-iframe { flex: 1; border: none; width: 100%; }

    .preview-empty {
      flex: 1; display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      gap: 1rem; color: #8899aa;
      font-size: 0.85rem; background: var(--bg);
    }
    .preview-empty-icon {
      font-size: 2.5rem; opacity: 0.3;
    }
  </style>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="./app.js"></script>
</body>
</html>`;
}
