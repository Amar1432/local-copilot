import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ProviderConfig } from "@private-copilot/shared";
import {
  DiagnosticsPanel,
  renderDiagnosticsHtml,
  type DiagnosticsSnapshot,
} from "./diagnostics-panel";
import { spy, resetMocks } from "../__mocks__/vscode";

const BASE_CONFIG: ProviderConfig = {
  enabled: true,
  provider: "custom",
  baseUrl: "http://localhost:11434/v1",
  apiKey: "",
  model: "qwen-coder",
  debounceMs: 150,
  requestTimeoutMs: 2000,
  maxOutputTokens: 128,
  temperature: 0.1,
  contextMaxLines: 120,
  localOnly: true,
  telemetryEnabled: false,
  contextBudgetPreset: "balanced",
};

function makeSnapshot(overrides?: Partial<DiagnosticsSnapshot>): DiagnosticsSnapshot {
  return {
    extensionVersion: "0.1.0",
    config: { ...BASE_CONFIG },
    apiKeyMasked: "(none)",
    connectionState: "idle",
    latencyMs: null,
    cacheStats: { hits: 21, misses: 47, size: 12, maxSize: 100 },
    ...overrides,
  };
}

describe("DiagnosticsPanel", () => {
  let snapshotLoader: ReturnType<typeof vi.fn<[], Promise<DiagnosticsSnapshot>>>;
  let panel: DiagnosticsPanel;

  beforeEach(() => {
    resetMocks();
    snapshotLoader = vi.fn(async () => makeSnapshot());
    panel = new DiagnosticsPanel(snapshotLoader);
  });

  // -----------------------------------------------------------------------
  // Panel lifecycle
  // -----------------------------------------------------------------------

  it("should create a webview panel on first show()", async () => {
    await panel.show();

    expect(spy.webviewPanels).toHaveLength(1);
    expect(spy.webviewPanels[0].viewType).toBe("privateCopilot.diagnostics");
    expect(spy.webviewPanels[0].title).toBe("Private Copilot Diagnostics");
    expect(spy.webviewPanels[0].visible).toBe(true);
    expect(panel.isVisible).toBe(true);
  });

  it("should reuse and reveal the same panel on subsequent show()", async () => {
    await panel.show();
    const created = spy.webviewPanels[0];

    await panel.show();

    expect(spy.webviewPanels).toHaveLength(1);
    expect(created.visible).toBe(true);
  });

  it("should pull a fresh snapshot every time show() is called", async () => {
    await panel.show();
    await panel.show();

    expect(snapshotLoader).toHaveBeenCalledTimes(2);
  });

  it("should dispose the underlying panel", async () => {
    await panel.show();
    const mockPanel = spy.webviewPanels[0];

    panel.dispose();

    expect(mockPanel.disposed).toBe(true);
    expect(panel.isVisible).toBe(false);
  });

  // -----------------------------------------------------------------------
  // Content rendering
  // -----------------------------------------------------------------------

  it("should render provider, model, and base URL", async () => {
    await panel.show();

    const html = spy.webviewPanels[0].webview.html;
    expect(html).toContain("custom");
    expect(html).toContain("qwen-coder");
    expect(html).toContain("http://localhost:11434/v1");
    expect(html).toContain("0.1.0");
  });

  it("should render connection status", async () => {
    snapshotLoader.mockResolvedValue(
      makeSnapshot({ connectionState: "connected", latencyMs: 182 })
    );
    await panel.show();

    const html = spy.webviewPanels[0].webview.html;
    expect(html).toContain('data-status="connected"');
    expect(html).toContain("Connected");
  });

  it("should render last request latency", async () => {
    snapshotLoader.mockResolvedValue(makeSnapshot({ latencyMs: 182 }));
    await panel.show();

    expect(spy.webviewPanels[0].webview.html).toContain("182 ms");
  });

  it('should render an em-dash placeholder when latency is unknown', async () => {
    await panel.show();

    const html = spy.webviewPanels[0].webview.html;
    expect(html).toContain("<td>—</td>");
    expect(html).not.toContain("null ms");
  });

  it("should render cache hit/miss counts", async () => {
    await panel.show();

    const html = spy.webviewPanels[0].webview.html;
    expect(html).toContain(">21</td>");
    expect(html).toContain(">47</td>");
  });

  it("should render placeholder dashes when cache stats are unavailable", async () => {
    snapshotLoader.mockResolvedValue(makeSnapshot({ cacheStats: null }));
    await panel.show();

    const html = spy.webviewPanels[0].webview.html;
    expect(html).toContain("Cache Stats");
    expect((html.match(/<td>—<\/td>/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });

  // -----------------------------------------------------------------------
  // Sensitive value masking
  // -----------------------------------------------------------------------

  it("should display only the pre-masked API key", async () => {
    snapshotLoader.mockResolvedValue(makeSnapshot({ apiKeyMasked: "sk-...cdef" }));
    await panel.show();

    const html = spy.webviewPanels[0].webview.html;
    expect(html).toContain("sk-...cdef");
  });

  it("should escape HTML-sensitive characters in rendered values", () => {
    const html = renderDiagnosticsHtml(
      makeSnapshot({
        config: { ...BASE_CONFIG, model: '<script>alert("x")</script>' },
      })
    );

    expect(html).not.toContain('<script>alert("x")</script>');
    expect(html).toContain("&lt;script&gt;");
  });

  // -----------------------------------------------------------------------
  // Real-time updates
  // -----------------------------------------------------------------------

  it("should re-render with fresh data when update() is called while open", async () => {
    snapshotLoader
      .mockResolvedValueOnce(makeSnapshot({ connectionState: "checking" }))
      .mockResolvedValueOnce(
        makeSnapshot({ connectionState: "connected", latencyMs: 95 })
      );

    await panel.show();
    expect(spy.webviewPanels[0].webview.html).toContain('data-status="checking"');

    await panel.update();
    const html = spy.webviewPanels[0].webview.html;
    expect(html).toContain('data-status="connected"');
    expect(html).toContain("95 ms");
  });

  it("should not throw or render when update() is called while closed", async () => {
    await expect(panel.update()).resolves.toBeUndefined();
    expect(snapshotLoader).not.toHaveBeenCalled();
  });

  it("should refresh when the webview posts a refresh message", async () => {
    let counter = 0;
    snapshotLoader.mockImplementation(async () => {
      counter += 1;
      return makeSnapshot({ latencyMs: counter * 10 });
    });

    await panel.show();
    const mockPanel = spy.webviewPanels[0];
    const before = mockPanel.webview.html;

    mockPanel.webview.post({ command: "refresh" });
    await vi.waitFor(() => {
      expect(mockPanel.webview.html).not.toBe(before);
    });

    expect(mockPanel.webview.html).toContain("20 ms");
  });

  it("should render completion metrics section with acceptance rate and latency percentiles", async () => {
    snapshotLoader.mockResolvedValue(
      makeSnapshot({
        metrics: {
          totalRequests: 10,
          successfulCompletions: 8,
          failedRequests: 1,
          cancelledRequests: 1,
          cacheHits: 4,
          cacheMisses: 6,
          cacheHitRate: 0.4,
          acceptedCompletions: 6,
          dismissedCompletions: 2,
          acceptanceRate: 0.75,
          totalCharsGenerated: 500,
          totalCharsAccepted: 400,
          totalLinesGenerated: 25,
          totalLinesAccepted: 20,
          latency: {
            count: 8,
            minMs: 50,
            maxMs: 250,
            avgMs: 120,
            p50Ms: 100,
            p90Ms: 200,
            p95Ms: 220,
            p99Ms: 250,
            lastMs: 110,
          },
          languages: {},
          recentErrors: [],
        },
      })
    );

    await panel.show();
    const html = spy.webviewPanels[0].webview.html;
    expect(html).toContain("Completion Metrics");
    expect(html).toContain("75.0%");
    expect(html).toContain(">10</td>"); // Total Requests
    expect(html).toContain(">8</td>"); // Completions Generated
    expect(html).toContain(">6</td>"); // Completions Accepted
    expect(html).toContain("1 / 1"); // Failed / Cancelled
    expect(html).toContain("100 ms / 220 ms / 120 ms"); // P50 / P95 / Avg
    expect(html).toContain("500 / 400"); // Chars
    expect(html).toContain("25 / 20"); // Lines
  });

  it("should ignore unrecognized messages from the webview", async () => {
    await panel.show();
    const mockPanel = spy.webviewPanels[0];
    const callsBefore = snapshotLoader.mock.calls.length;

    mockPanel.webview.post({ command: "bogus" });

    expect(snapshotLoader.mock.calls.length).toBe(callsBefore);
  });

  // -----------------------------------------------------------------------
  // Webview action messages route to helper commands
  // -----------------------------------------------------------------------

  it("should route a clearCache webview message to the privateCopilot.clearCache command", async () => {
    await panel.show();
    spy.webviewPanels[0].webview.post({ command: "clearCache" });

    expect(
      spy.commands.some((c) => c.command === "privateCopilot.clearCache")
    ).toBe(true);
  });

  it("should route a resetMetrics webview message to the privateCopilot.resetMetrics command", async () => {
    await panel.show();
    spy.webviewPanels[0].webview.post({ command: "resetMetrics" });

    expect(
      spy.commands.some((c) => c.command === "privateCopilot.resetMetrics")
    ).toBe(true);
  });

  it("should route an export webview message to the privateCopilot.exportDiagnostics command", async () => {
    await panel.show();
    spy.webviewPanels[0].webview.post({ command: "export" });

    expect(
      spy.commands.some((c) => c.command === "privateCopilot.exportDiagnostics")
    ).toBe(true);
  });

  it("should route an openSettings webview message to the privateCopilot.openSettings command", async () => {
    await panel.show();
    spy.webviewPanels[0].webview.post({ command: "openSettings" });

    expect(
      spy.commands.some((c) => c.command === "privateCopilot.openSettings")
    ).toBe(true);
  });

  it("should still refresh when the webview posts a refresh message", async () => {
    let counter = 0;
    snapshotLoader.mockImplementation(async () => {
      counter += 1;
      return makeSnapshot({ latencyMs: counter * 7 });
    });

    await panel.show();
    const mockPanel = spy.webviewPanels[0];

    mockPanel.webview.post({ command: "refresh" });
    await vi.waitFor(() => {
      expect(mockPanel.webview.html).toContain("14 ms");
    });
  });

  // -----------------------------------------------------------------------
  // Action buttons (UX)
  // -----------------------------------------------------------------------

  it("should render action buttons for all diagnostics actions", async () => {
    await panel.show();
    const html = spy.webviewPanels[0].webview.html;

    for (const action of [
      "refresh",
      "clearCache",
      "resetMetrics",
      "export",
      "openSettings",
    ]) {
      expect(html).toContain(`data-action="${action}"`);
    }
  });
});
