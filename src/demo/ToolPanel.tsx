import { useState } from 'preact/hooks';
import type { JSX } from 'preact/jsx-runtime';
import type { ActivePanel, RunResult } from './App.tsx';
import type { DemoStep } from './steps.ts';

interface ToolPanelProps {
	steps: DemoStep[];
	results: Map<string, RunResult>;
	onRun: (stepId: string, toolName: string, input: Record<string, unknown>) => Promise<void>;
	activePanel: ActivePanel;
}

export const TOOL_META: Record<string, { color: string; glow: string; hint: string }> = {
	site_read: {
		color: '#00d4ff',
		glow: 'rgba(0,212,255,0.25)',
		hint: 'Read-only inspection of pages, templates, data, and fitness scores.',
	},
	site_write: {
		color: '#ff9500',
		glow: 'rgba(255,149,0,0.25)',
		hint: 'Create, update, or delete content, templates, and data. Mutates disk.',
	},
	site_build: {
		color: '#ff2d78',
		glow: 'rgba(255,45,120,0.25)',
		hint: 'Runs the full build pipeline: discovers pages, renders HTML, writes dist/.',
	},
	site_check: {
		color: '#bf5fff',
		glow: 'rgba(191,95,255,0.25)',
		hint: 'Runs all 19 fitness analyzers and returns a scored issue report.',
	},
	site_plan: {
		color: '#39ff14',
		glow: 'rgba(57,255,20,0.25)',
		hint: 'Dry-run: simulates changes and returns the fitness delta before writing.',
	},
};

function CopyButton({ text }: { text: string }): JSX.Element {
	const [copied, setCopied] = useState(false);
	const handleCopy = async () => {
		await navigator.clipboard.writeText(text);
		setCopied(true);
		setTimeout(() => setCopied(false), 1500);
	};
	return (
		<button type="button" class="copy-btn" onClick={handleCopy} title="Copy to clipboard">
			{copied ? '✓' : '⎘'}
		</button>
	);
}

// Tooltip is CSS-only hover — no JS state, no a11y issues with event handlers on spans.
function ToolTooltip({ tool }: { tool: string }): JSX.Element {
	const meta = TOOL_META[tool];
	return (
		<span class="tooltip-wrap">
			<span
				class="tool-badge"
				style={`--tc: ${meta?.color ?? '#888'}; --tg: ${meta?.glow ?? 'transparent'}`}
			>
				{tool}
			</span>
			{meta && <span class="tooltip-popup">{meta.hint}</span>}
		</span>
	);
}

function StepCard({
	step,
	index,
	result,
	onRun,
}: {
	step: DemoStep;
	index: number;
	result: RunResult | undefined;
	onRun: (stepId: string, toolName: string, input: Record<string, unknown>) => Promise<void>;
}): JSX.Element {
	const [inputJson, setInputJson] = useState(JSON.stringify(step.input, null, 2));
	const [jsonError, setJsonError] = useState('');
	const [running, setRunning] = useState(false);
	const [resultOpen, setResultOpen] = useState(false);
	const meta = TOOL_META[step.tool];

	const hasResult = Boolean(result);
	const isSuccess = result?.status === 'success';
	const isError = result?.status === 'error';

	const handleRun = async () => {
		let parsed: Record<string, unknown>;
		try {
			parsed = JSON.parse(inputJson);
			setJsonError('');
		} catch {
			setJsonError('Invalid JSON — check brackets and quotes.');
			return;
		}
		setRunning(true);
		try {
			await onRun(step.id, step.tool, parsed);
			setResultOpen(true);
		} finally {
			setRunning(false);
		}
	};

	const resultJson = result ? JSON.stringify(result.data, null, 2) : '';

	return (
		<div
			class={`step-card ${isSuccess ? 'step-success' : ''} ${isError ? 'step-error' : ''}`}
			style={`--tc: ${meta?.color ?? '#888'}; --tg: ${meta?.glow ?? 'transparent'}`}
		>
			<div class="step-header">
				<span class="step-num">{String(index + 1).padStart(2, '0')}</span>
				<span class="step-title">{step.title.replace(/^\d+ · /, '')}</span>
				<ToolTooltip tool={step.tool} />
				{hasResult && (
					<span
						class={`step-status-dot ${isSuccess ? 'dot-ok' : isError ? 'dot-err' : 'dot-warn'}`}
						title={result?.status}
					/>
				)}
			</div>

			<p class="step-desc">{step.description}</p>

			<div class="step-input-wrap">
				<div class="step-input-label">
					<span>input.json</span>
					<CopyButton text={inputJson} />
				</div>
				<textarea
					class={`json-input ${jsonError ? 'json-invalid' : ''}`}
					value={inputJson}
					onInput={(e) => setInputJson((e.target as HTMLTextAreaElement).value)}
					rows={Math.min(14, inputJson.split('\n').length + 1)}
					spellcheck={false}
					autocomplete="off"
				/>
				{jsonError && <div class="json-error-bar">{jsonError}</div>}
			</div>

			<div class="step-footer">
				<button
					type="button"
					class="run-btn"
					onClick={handleRun}
					disabled={running}
					style={`--tc: ${meta?.color ?? '#888'}; --tg: ${meta?.glow ?? 'transparent'}`}
				>
					{running ? (
						<>
							<span class="run-spinner" /> running…
						</>
					) : (
						<>▶ Run</>
					)}
				</button>
				{hasResult && (
					<button type="button" class="result-toggle" onClick={() => setResultOpen((v) => !v)}>
						{resultOpen ? '▲' : '▼'} result
						<span class={`result-status-label ${isSuccess ? 'ok' : 'err'}`}>{result?.status}</span>
					</button>
				)}
			</div>

			{hasResult && resultOpen && (
				<div class="step-result">
					<div class="result-header">
						<span class="result-label">output</span>
						<CopyButton text={resultJson} />
					</div>
					<pre class="result-json">{resultJson}</pre>
				</div>
			)}
		</div>
	);
}

export function ToolPanel({ steps, results, onRun, activePanel }: ToolPanelProps): JSX.Element {
	return (
		<aside class={`tool-panel ${activePanel !== 'tools' ? 'panel-hidden' : ''}`}>
			<div class="tool-panel-intro">
				<div class="intro-title">How it works</div>
				<p class="intro-text">
					This demo runs the full <code>@ghostpaw/website</code> build pipeline entirely in your
					browser — no server, no install. Each step calls a real tool against a real in-memory
					filesystem. Edit the JSON input, hit
					<strong> ▶ Run</strong>, and watch the preview update live.
				</p>
				<div class="intro-legend">
					{Object.entries(TOOL_META).map(([name, meta]) => (
						<span key={name} class="legend-item" style={`--tc: ${meta.color}`}>
							{name}
						</span>
					))}
				</div>
			</div>
			<div class="step-list">
				{steps.map((step, i) => (
					<StepCard
						key={step.id}
						step={step}
						index={i}
						result={results.get(step.id)}
						onRun={onRun}
					/>
				))}
			</div>
		</aside>
	);
}
