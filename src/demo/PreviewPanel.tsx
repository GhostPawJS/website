import { useRef } from 'preact/hooks';
import type { JSX } from 'preact/jsx-runtime';
import type { ActivePanel } from './App.tsx';

interface PreviewPanelProps {
	pages: Map<string, string>;
	activeUrl: string;
	onNavigate: (url: string) => void;
	activePanel: ActivePanel;
}

export function PreviewPanel({
	pages,
	activeUrl,
	onNavigate,
	activePanel,
}: PreviewPanelProps): JSX.Element {
	const iframeRef = useRef<HTMLIFrameElement>(null);

	const sortedUrls = Array.from(pages.keys()).sort((a, b) => {
		if (a === '/') return -1;
		if (b === '/') return 1;
		return a.localeCompare(b);
	});

	const htmlContent = pages.get(activeUrl) ?? '';

	const rewrittenHtml = htmlContent.replace(/href="(\/[^"#?]*?)"/g, (_match, href) => {
		const normalised = href.endsWith('/') ? href : `${href}/`;
		if (pages.has(href) || pages.has(normalised)) {
			return `href="javascript:void(0)" data-nav="${pages.has(href) ? href : normalised}"`;
		}
		return `href="${href}" target="_blank" rel="noopener"`;
	});

	const withNavScript = rewrittenHtml.replace(
		'</body>',
		`<script>
document.addEventListener('click', function(e) {
  var el = e.target && e.target.closest('[data-nav]');
  if (el) { e.preventDefault(); window.parent.postMessage({ type: 'navigate', url: el.dataset.nav }, '*'); }
});
</script></body>`,
	);

	if (typeof window !== 'undefined') {
		window.onmessage = (ev) => {
			if (ev.data?.type === 'navigate' && typeof ev.data.url === 'string') {
				onNavigate(ev.data.url);
			}
		};
	}

	const urlLabel = activeUrl === '/' ? 'index' : activeUrl.replace(/^\/|\/$/g, '');

	return (
		<div class={`preview-panel ${activePanel !== 'preview' ? 'panel-hidden' : ''}`}>
			{/* Browser chrome */}
			<div class="browser-chrome">
				<div class="browser-controls">
					<span class="browser-dot dot-close" />
					<span class="browser-dot dot-min" />
					<span class="browser-dot dot-max" />
				</div>
				<div class="browser-address">
					<span class="address-scheme">https://</span>
					<span class="address-host">heliostat.io</span>
					<span class="address-path">{activeUrl}</span>
				</div>
				<div class="browser-controls-right">
					<span class="browser-badge">demo</span>
				</div>
			</div>

			{/* Page tabs */}
			<div class="preview-tabs" role="tablist">
				{sortedUrls.map((url) => {
					const label = url === '/' ? '/' : url.replace(/^\/|\/$/g, '');
					return (
						<button
							type="button"
							key={url}
							role="tab"
							aria-selected={url === activeUrl}
							class={`preview-tab ${url === activeUrl ? 'tab-active' : ''}`}
							onClick={() => onNavigate(url)}
							title={url}
						>
							{label}
						</button>
					);
				})}
			</div>

			{/* Iframe preview */}
			{pages.size > 0 ? (
				<iframe
					ref={iframeRef}
					class="preview-iframe"
					srcdoc={withNavScript}
					sandbox="allow-scripts allow-same-origin"
					title={`Preview: ${urlLabel}`}
				/>
			) : (
				<div class="preview-empty">
					<span class="preview-empty-icon">◌</span>
					<span>No pages built yet — run a step to see the preview.</span>
				</div>
			)}
		</div>
	);
}
