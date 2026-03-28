import { useEffect, useState } from 'preact/hooks';
import type { JSX } from 'preact/jsx-runtime';
import { tools } from '../index.ts';
import { PreviewPanel } from './PreviewPanel.tsx';
import { DEMO_DIR, seedSite } from './seed.ts';
import { DEMO_STEPS } from './steps.ts';
import { ToolPanel } from './ToolPanel.tsx';
import { vol } from './vfs.ts';

const { siteRead, siteWrite, siteBuild, siteCheck, sitePlan } = tools;

export type AppStatus = 'booting' | 'ready' | 'error';
export type ActivePanel = 'tools' | 'preview';

export interface RunResult {
	stepId: string;
	toolName: string;
	status: string;
	data: unknown;
	ts: number;
}

function getToolFn(name: string) {
	switch (name) {
		case 'site_read':
			return siteRead;
		case 'site_write':
			return siteWrite;
		case 'site_build':
			return siteBuild;
		case 'site_check':
			return siteCheck;
		case 'site_plan':
			return sitePlan;
		default:
			throw new Error(`Unknown tool: ${name}`);
	}
}

/** Read all text assets (CSS, JS) from dist and return as a path→content map. */
function readDistAssets(): Map<string, string> {
	const assets = new Map<string, string>();
	const distDir = `${DEMO_DIR}/dist`;

	function walk(dir: string): void {
		let entries: string[];
		try {
			entries = vol.readdirSync(dir) as string[];
		} catch {
			return;
		}
		for (const entry of entries) {
			const full = `${dir}/${entry}`;
			if (vol.statSync(full).isDirectory()) {
				walk(full);
			} else if (/\.(css|js)$/.test(entry)) {
				const rel = full.slice(distDir.length); // e.g. /assets/style.css
				assets.set(rel, vol.readFileSync(full, 'utf8') as string);
			}
		}
	}

	walk(distDir);
	return assets;
}

/** Inline <link stylesheet> and <script src> tags using the assets map. */
function inlineAssets(html: string, assets: Map<string, string>): string {
	// Inline CSS: <link rel="stylesheet" href="/assets/style.css">
	html = html.replace(/<link\s+rel="stylesheet"\s+href="([^"]+)"\s*\/?>/gi, (_m, href) => {
		const css = assets.get(href);
		return css ? `<style>${css}</style>` : '';
	});
	// Inline JS: <script src="/assets/foo.js"></script>
	html = html.replace(/<script\s+src="([^"]+)"([^>]*)><\/script>/gi, (_m, src, attrs) => {
		if (/external|cdn|http/i.test(src)) return _m;
		const js = assets.get(src);
		return js ? `<script${attrs}>${js}</script>` : '';
	});
	return html;
}

function readDistPages(): Map<string, string> {
	const pages = new Map<string, string>();
	const distDir = `${DEMO_DIR}/dist`;
	const assets = readDistAssets();

	function walkDir(dir: string): void {
		let entries: string[];
		try {
			entries = vol.readdirSync(dir) as string[];
		} catch {
			return;
		}
		for (const entry of entries) {
			const full = `${dir}/${entry}`;
			const stat = vol.statSync(full);
			if (stat.isDirectory()) {
				walkDir(full);
			} else if (entry.endsWith('.html')) {
				const raw = vol.readFileSync(full, 'utf8') as string;
				const inlined = inlineAssets(raw, assets);
				const rel = full.slice(distDir.length);
				const url = rel.endsWith('/index.html') ? rel.slice(0, -'index.html'.length) : rel;
				pages.set(url || '/', inlined);
			}
		}
	}

	walkDir(distDir);
	return pages;
}

const BOOT_PHASES = [
	'Initialising virtual filesystem…',
	'Scaffolding Heliostat site…',
	'Writing demo content…',
	'Running fitness analysis…',
	'Building output HTML…',
	'Ready.',
];

export function App(): JSX.Element {
	const [status, setStatus] = useState<AppStatus>('booting');
	const [bootPhase, setBootPhase] = useState(0);
	const [bootError, setBootError] = useState('');
	const [pages, setPages] = useState<Map<string, string>>(new Map());
	const [activeUrl, setActiveUrl] = useState('/');
	const [results, setResults] = useState<Map<string, RunResult>>(new Map());
	const [rebuilding, setRebuilding] = useState(false);
	const [activePanel, setActivePanel] = useState<ActivePanel>('tools');

	useEffect(() => {
		let phase = 0;
		const tick = setInterval(() => {
			phase = Math.min(phase + 1, BOOT_PHASES.length - 2);
			setBootPhase(phase);
		}, 600);

		seedSite()
			.then(() => {
				clearInterval(tick);
				setBootPhase(BOOT_PHASES.length - 1);
				const p = readDistPages();
				setPages(p);
				if (!p.has('/')) setActiveUrl(p.keys().next().value ?? '/');
				setTimeout(() => setStatus('ready'), 300);
			})
			.catch((err) => {
				clearInterval(tick);
				setBootError(err instanceof Error ? err.message : String(err));
				setStatus('error');
			});
	}, []);

	const runStep = async (stepId: string, toolName: string, input: Record<string, unknown>) => {
		const fn = getToolFn(toolName);
		const result = await fn.call(DEMO_DIR, input as never);

		setResults((prev) =>
			new Map(prev).set(stepId, {
				stepId,
				toolName,
				status: result.status,
				data: result,
				ts: Date.now(),
			}),
		);

		if (toolName === 'site_write' && result.status === 'success') {
			setRebuilding(true);
			try {
				await siteBuild.call(DEMO_DIR, { action: 'build' });
				setPages(readDistPages());
				setActivePanel('preview');
			} finally {
				setRebuilding(false);
			}
		}
	};

	if (status === 'booting') {
		return (
			<div class="boot-screen">
				<div class="boot-logo">
					<span class="boot-logo-bracket">[</span>
					<span class="boot-logo-text">ghostpaw</span>
					<span class="boot-logo-slash">/</span>
					<span class="boot-logo-pkg">website</span>
					<span class="boot-logo-bracket">]</span>
				</div>
				<div class="boot-terminal">
					{BOOT_PHASES.slice(0, bootPhase + 1).map((line, i) => (
						<div key={i} class={`boot-line ${i === bootPhase ? 'active' : 'done'}`}>
							<span class="boot-prompt">›</span>
							<span>{line}</span>
							{i === bootPhase && <span class="boot-cursor">▋</span>}
						</div>
					))}
				</div>
			</div>
		);
	}

	if (status === 'error') {
		return (
			<div class="boot-screen error">
				<div class="boot-logo">
					<span class="boot-logo-bracket error">[</span>
					<span class="boot-logo-text">boot failed</span>
					<span class="boot-logo-bracket error">]</span>
				</div>
				<pre class="boot-error">{bootError}</pre>
			</div>
		);
	}

	const completedCount = results.size;
	const totalCount = DEMO_STEPS.length;

	return (
		<div class="app">
			<header class="app-header">
				<div class="app-header-left">
					<span class="app-brand">
						<span class="brand-bracket">[</span>
						<span class="brand-pkg">@ghostpaw/website</span>
						<span class="brand-bracket">]</span>
					</span>
					<span class="app-divider">·</span>
					<span class="app-tagline">interactive demo</span>
				</div>
				<div class="app-header-center">
					<div class="app-progress">
						<div class="progress-bar" style={`width: ${(completedCount / totalCount) * 100}%`} />
					</div>
					<span class="app-progress-label">
						{completedCount}/{totalCount} steps run
					</span>
				</div>
				<div class="app-header-right">
					{rebuilding && (
						<span class="rebuilding-badge">
							<span class="rebuilding-dot" />
							rebuilding
						</span>
					)}
					<div class="panel-toggle">
						<button
							type="button"
							class={`panel-toggle-btn ${activePanel === 'tools' ? 'active' : ''}`}
							onClick={() => setActivePanel('tools')}
						>
							Tools
						</button>
						<button
							type="button"
							class={`panel-toggle-btn ${activePanel === 'preview' ? 'active' : ''}`}
							onClick={() => setActivePanel('preview')}
						>
							Preview
						</button>
					</div>
				</div>
			</header>
			<div class="app-body">
				<ToolPanel steps={DEMO_STEPS} results={results} onRun={runStep} activePanel={activePanel} />
				<div class="panel-divider" />
				<PreviewPanel
					pages={pages}
					activeUrl={activeUrl}
					onNavigate={(url) => {
						setActiveUrl(url);
						setActivePanel('preview');
					}}
					activePanel={activePanel}
				/>
			</div>
		</div>
	);
}
