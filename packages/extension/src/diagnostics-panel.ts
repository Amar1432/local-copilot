import * as vscode from "vscode";
import type { ProviderConfig } from "@local-copilot/shared";
import type { MetricsSummary } from "@local-copilot/core";

const PANEL_VIEW_TYPE = "localCopilot.diagnostics";
const PANEL_TITLE = "Local Copilot Diagnostics";

/**
 * Immutable snapshot of everything the diagnostics panel renders.
 * Built externally (extension.ts) from configuration, orchestrator state,
 * and cache statistics. Sensitive values must already be masked.
 */
export interface DiagnosticsSnapshot {
  readonly extensionVersion: string;
  readonly config: ProviderConfig;
  /** Pre-masked API key safe for display */
  readonly apiKeyMasked: string;
  readonly connectionState: "idle" | "connected" | "disconnected" | "checking";
  readonly latencyMs: number | null;
  readonly cacheStats:
    | {
        readonly hits: number;
        readonly misses: number;
        readonly size: number;
        readonly maxSize: number;
      }
    | null;
  readonly metrics?: MetricsSummary | null;
}

/**
 * Real-time webview diagnostics panel.
 *
 * Replaces the previous modal diagnostics dialog. The panel stays open,
 * re-renders whenever update() is called (configuration changes, connection
 * tests), and supports a refresh message from the webview itself.
 */
export class DiagnosticsPanel implements vscode.Disposable {
  private panel: vscode.WebviewPanel | undefined;
  private readonly disposables: vscode.Disposable[] = [];
  private html = "";

  constructor(private readonly loadSnapshot: () => Promise<DiagnosticsSnapshot>) {}

  /**
   * Whether the panel is currently open and visible.
   */
  get isVisible(): boolean {
    return this.panel?.visible ?? false;
  }

  /**
   * The most recently rendered HTML content.
   */
  get currentHtml(): string {
    return this.html;
  }

  /**
   * Open the panel, or reveal it if it is already open. Always pulls a
   * fresh snapshot so revealed content is up to date.
   */
  async show(): Promise<void> {
    if (this.panel) {
      this.panel.reveal();
      await this.refresh();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      PANEL_VIEW_TYPE,
      PANEL_TITLE,
      vscode.ViewColumn.One,
      { enableScripts: true }
    );
    this.panel = panel;

    panel.onDidDispose(
      () => {
        this.panel = undefined;
      },
      null,
      this.disposables
    );

    panel.webview.onDidReceiveMessage(
      (message: unknown) => {
        if (
          typeof message !== "object" ||
          message === null ||
          !("command" in message)
        ) {
          return;
        }
        const command = (message as { command: unknown }).command;
        switch (command) {
          case "refresh":
            void this.refresh();
            break;
          case "clearCache":
            void vscode.commands.executeCommand("localCopilot.clearCache");
            break;
          case "resetMetrics":
            void vscode.commands.executeCommand("localCopilot.resetMetrics");
            break;
          case "export":
            void vscode.commands.executeCommand("localCopilot.exportDiagnostics");
            break;
          case "openSettings":
            void vscode.commands.executeCommand("localCopilot.openSettings");
            break;
          default:
            break;
        }
      },
      null,
      this.disposables
    );

    await this.refresh();
  }

  /**
   * Re-render the panel with a fresh snapshot. No-op when the panel is
   * closed — call show() to reopen it.
   */
  async update(): Promise<void> {
    if (!this.panel) return;
    await this.refresh();
  }

  private async refresh(): Promise<void> {
    if (!this.panel) return;
    const snapshot = await this.loadSnapshot();
    this.html = renderDiagnosticsHtml(snapshot);
    this.panel.webview.html = this.html;
  }

  dispose(): void {
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables.length = 0;
    this.panel?.dispose();
    this.panel = undefined;
  }
}

/**
 * Render the diagnostics panel HTML using VS Code theme variables so the
 * panel adapts automatically to light/dark/high-contrast themes.
 */
export function renderDiagnosticsHtml(snapshot: DiagnosticsSnapshot): string {
  const { config, metrics } = snapshot;
  const statusClass =
    snapshot.connectionState === "connected"
      ? "connected"
      : snapshot.connectionState === "checking"
        ? "checking"
        : "disconnected";

  const statusLabel =
    snapshot.connectionState === "connected"
      ? "Connected"
      : snapshot.connectionState === "checking"
        ? "Checking..."
        : snapshot.connectionState === "disconnected"
          ? "Disconnected"
          : "Idle";

  const latency = snapshot.latencyMs !== null ? `${snapshot.latencyMs} ms` : "—";
  const cacheHits = snapshot.cacheStats ? String(snapshot.cacheStats.hits) : "—";
  const cacheMisses = snapshot.cacheStats ? String(snapshot.cacheStats.misses) : "—";
  const cacheEntries = snapshot.cacheStats
    ? `${snapshot.cacheStats.size} / ${snapshot.cacheStats.maxSize}`
    : "—";

  const acceptanceRateText = metrics
    ? `${(metrics.acceptanceRate * 100).toFixed(1)}% (${metrics.acceptedCompletions} / ${metrics.successfulCompletions || metrics.acceptedCompletions + metrics.dismissedCompletions})`
    : "—";

  const p50Text = metrics?.latency.p50Ms !== null && metrics?.latency.p50Ms !== undefined ? `${metrics.latency.p50Ms} ms` : "—";
  const p95Text = metrics?.latency.p95Ms !== null && metrics?.latency.p95Ms !== undefined ? `${metrics.latency.p95Ms} ms` : "—";
  const avgLatencyText = metrics?.latency.avgMs !== null && metrics?.latency.avgMs !== undefined ? `${metrics.latency.avgMs} ms` : "—";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';">
<style>
  :root {
    --lc-connected: var(--vscode-charts-green, #4EC9B0);
    --lc-cloud: var(--vscode-charts-blue, #569CD6);
    --lc-error: var(--vscode-charts-red, #F44747);
    --lc-warning: var(--vscode-charts-yellow, #CCA700);
    --lc-disabled: var(--vscode-descriptionForeground, #808080);
  }
  body {
    background-color: var(--vscode-editor-background);
    color: var(--vscode-editor-foreground);
    font-family: var(--vscode-font-family);
    font-size: var(--vscode-font-size, 13px);
    padding: 16px;
    margin: 0;
  }
  h1 {
    font-size: 1.2em;
    font-weight: 600;
    margin: 0 0 16px 0;
  }
  section {
    margin-bottom: 16px;
    border: 1px solid var(--vscode-panel-border, transparent);
    border-radius: 4px;
    padding: 12px;
  }
  h2 {
    font-size: 1em;
    font-weight: 600;
    margin: 0 0 8px 0;
    color: var(--vscode-sideBarSectionHeader-foreground, inherit);
  }
  table {
    width: 100%;
    border-collapse: collapse;
  }
  th {
    text-align: left;
    font-weight: normal;
    color: var(--vscode-descriptionForeground);
    width: 45%;
    vertical-align: top;
    padding: 4px 8px 4px 0;
  }
  td {
    font-family: var(--vscode-editor-font-family, monospace);
    word-break: break-all;
    padding: 4px 0;
  }
  .status-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-left: 8px;
  }
  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    display: inline-block;
  }
  .dot.connected { background-color: var(--lc-connected); }
  .dot.checking { background-color: var(--lc-warning); }
  .dot.disconnected { background-color: var(--lc-error); }
  .actions { display: flex; flex-wrap: wrap; gap: 8px; }
  .actions button {
    background-color: var(--vscode-button-background, #007acc);
    color: var(--vscode-button-foreground, #ffffff);
    border: none;
    border-radius: 4px;
    padding: 6px 12px;
    font-family: inherit;
    font-size: inherit;
    cursor: pointer;
  }
  .actions button:hover { background-color: var(--vscode-button-hoverBackground, #0a6ebd); }
</style>
</head>
<body aria-label="Local Copilot Diagnostics">
  <h1>Local Copilot Diagnostics
    <span class="status-badge" role="status" data-status="${snapshot.connectionState}">
      <span class="dot ${statusClass}" aria-hidden="true"></span>${statusLabel}
    </span>
  </h1>

  <section aria-labelledby="provider-heading">
    <h2 id="provider-heading">Provider</h2>
    <table>
      <tr><th>Extension Version</th><td>${escapeHtml(snapshot.extensionVersion)}</td></tr>
      <tr><th>Provider</th><td>${escapeHtml(config.provider)}</td></tr>
      <tr><th>Model</th><td>${escapeHtml(config.model || "(not set)")}</td></tr>
      <tr><th>Base URL</th><td>${escapeHtml(config.baseUrl)}</td></tr>
      <tr><th>API Key</th><td>${escapeHtml(snapshot.apiKeyMasked)}</td></tr>
      <tr><th>Local Only</th><td>${config.localOnly ? "Yes" : "No"}</td></tr>
    </table>
  </section>

  <section aria-labelledby="config-heading">
    <h2 id="config-heading">Configuration</h2>
    <table>
      <tr><th>Debounce</th><td>${config.debounceMs} ms</td></tr>
      <tr><th>Request Timeout</th><td>${config.requestTimeoutMs} ms</td></tr>
      <tr><th>Max Output Tokens</th><td>${config.maxOutputTokens}</td></tr>
      <tr><th>Temperature</th><td>${config.temperature}</td></tr>
      <tr><th>Context Max Lines</th><td>${config.contextMaxLines}</td></tr>
      <tr><th>Context Budget Preset</th><td>${escapeHtml(config.contextBudgetPreset ?? "balanced")}</td></tr>
      <tr><th>Telemetry</th><td>${config.telemetryEnabled ? "Enabled" : "Disabled"}</td></tr>
    </table>
  </section>

  <section aria-labelledby="metrics-heading">
    <h2 id="metrics-heading">Completion Metrics</h2>
    <table>
      <tr><th>Acceptance Rate</th><td>${escapeHtml(acceptanceRateText)}</td></tr>
      <tr><th>Total Requests</th><td>${metrics ? metrics.totalRequests : "—"}</td></tr>
      <tr><th>Completions Generated</th><td>${metrics ? metrics.successfulCompletions : "—"}</td></tr>
      <tr><th>Completions Accepted</th><td>${metrics ? metrics.acceptedCompletions : "—"}</td></tr>
      <tr><th>Failed / Cancelled</th><td>${metrics ? `${metrics.failedRequests} / ${metrics.cancelledRequests}` : "—"}</td></tr>
      <tr><th>Latency (P50 / P95 / Avg)</th><td>${escapeHtml(`${p50Text} / ${p95Text} / ${avgLatencyText}`)}</td></tr>
      <tr><th>Characters (Gen / Acc)</th><td>${metrics ? `${metrics.totalCharsGenerated} / ${metrics.totalCharsAccepted}` : "—"}</td></tr>
      <tr><th>Lines (Gen / Acc)</th><td>${metrics ? `${metrics.totalLinesGenerated} / ${metrics.totalLinesAccepted}` : "—"}</td></tr>
    </table>
  </section>

  <section aria-labelledby="performance-heading">
    <h2 id="performance-heading">Last Request</h2>
    <table>
      <tr><th>Status</th><td role="status">${statusLabel}</td></tr>
      <tr><th>Latency</th><td>${latency}</td></tr>
    </table>
  </section>

  <section aria-labelledby="cache-heading">
    <h2 id="cache-heading">Cache Stats</h2>
    <table>
      <tr><th>Hits</th><td>${cacheHits}</td></tr>
      <tr><th>Misses</th><td>${cacheMisses}</td></tr>
      <tr><th>Entries</th><td>${cacheEntries}</td></tr>
    </table>
  </section>

  <section aria-labelledby="actions-heading">
    <h2 id="actions-heading">Actions</h2>
    <div class="actions">
      <button type="button" data-action="refresh">Refresh</button>
      <button type="button" data-action="clearCache">Clear Cache</button>
      <button type="button" data-action="resetMetrics">Reset Metrics</button>
      <button type="button" data-action="export">Export JSON</button>
      <button type="button" data-action="openSettings">Open Settings</button>
    </div>
  </section>

<script>
(function () {
  var vscodeApi = acquireVsCodeApi();
  document.addEventListener('keydown', function (event) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'r') {
      vscodeApi.postMessage({ command: 'refresh' });
    }
  });
  document.querySelectorAll('button[data-action]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      vscodeApi.postMessage({ command: btn.getAttribute('data-action') });
    });
  });
})();
</script>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
