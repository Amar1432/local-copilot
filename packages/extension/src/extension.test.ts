import { describe, it, expect, vi, beforeEach } from "vitest";
import * as vscode from "vscode";
import { activate } from "./extension";
import { CompletionOrchestrator } from "./completion-orchestrator";
import { resetMocks, spy } from "../__mocks__/vscode";

describe("Extension Commands & selectModel", () => {
  let mockContext: { subscriptions: Array<{ dispose: () => void }>; secrets: typeof spy.secrets };
  let commandHandlers: Map<string, (...args: unknown[]) => Promise<unknown> | unknown>;

  beforeEach(() => {
    resetMocks();
    commandHandlers = new Map();
    mockContext = {
      subscriptions: [],
      secrets: spy.secrets,
    };

    // Capture registered command callbacks
    vi.spyOn(vscode.commands, "registerCommand").mockImplementation(
      (command: string, callback: (...args: unknown[]) => unknown) => {
        commandHandlers.set(command, callback);
        return new (vscode as unknown as { MockDisposable: new () => { dispose: () => void } }).MockDisposable();
      }
    );
  });

  it("should activate and register localCopilot commands", async () => {
    await activate(mockContext as unknown as vscode.ExtensionContext);
    expect(commandHandlers.has("localCopilot.selectModel")).toBe(true);
    expect(commandHandlers.has("localCopilot.selectProvider")).toBe(true);
    expect(commandHandlers.has("localCopilot.testConnection")).toBe(true);
    expect(commandHandlers.has("localCopilot.showDiagnostics")).toBe(true);
    expect(commandHandlers.has("localCopilot.setApiKey")).toBe(true);
    expect(commandHandlers.has("localCopilot.deleteApiKey")).toBe(true);
    expect(commandHandlers.has("localCopilot.statusBarMenu")).toBe(true);
    expect(commandHandlers.has("localCopilot.toggle")).toBe(true);
    expect(commandHandlers.has("localCopilot.quickSettings")).toBe(true);
    expect(commandHandlers.has("localCopilot.setupWizard")).toBe(true);
    expect(commandHandlers.has("localCopilot.refreshDiagnostics")).toBe(true);
    expect(commandHandlers.has("localCopilot.exportDiagnostics")).toBe(true);
    expect(commandHandlers.has("localCopilot.exportTelemetry")).toBe(true);
  });

  it("should export anonymized telemetry JSON to the clipboard via localCopilot.exportTelemetry", async () => {
    await activate(mockContext as unknown as vscode.ExtensionContext);

    const handler = commandHandlers.get("localCopilot.exportTelemetry");
    expect(handler).toBeDefined();
    await handler!();

    expect(spy.clipboardText).toContain("schemaVersion");
    expect(spy.clipboardText).toContain("sessionId");
    expect(spy.clipboardText).toContain("totalRequests");
    expect(spy.informationMessages).toContain("Anonymized telemetry payload copied to clipboard.");
  });

  it("should export diagnostics JSON to the clipboard via localCopilot.exportDiagnostics", async () => {
    await activate(mockContext as unknown as vscode.ExtensionContext);

    const handler = commandHandlers.get("localCopilot.exportDiagnostics");
    expect(handler).toBeDefined();
    await handler!();

    expect(spy.clipboardText).toContain("extensionVersion");
    expect(spy.clipboardText).toContain("config");
    expect(spy.informationMessages).toContain("Diagnostics exported to clipboard.");
  });

  it("should refresh diagnostics without throwing via localCopilot.refreshDiagnostics", async () => {
    await activate(mockContext as unknown as vscode.ExtensionContext);

    const handler = commandHandlers.get("localCopilot.refreshDiagnostics");
    expect(handler).toBeDefined();
    await expect(handler!()).resolves.toBeUndefined();
    expect(spy.informationMessages).toContain("Diagnostics refreshed.");
  });

  it("should run setup wizard and apply provider/baseUrl/model and save API key", async () => {
    await activate(mockContext as unknown as vscode.ExtensionContext);

    vi.spyOn(
      CompletionOrchestrator.prototype,
      "testProviderConnection"
    ).mockResolvedValue(true);

    let qpCall = 0;
    vi.spyOn(vscode.window, "showQuickPick").mockImplementation(
      async (_items) => {
        qpCall += 1;
        if (qpCall === 1) {
          // Step 1: select provider "ollama"
          return { label: "ollama" } as unknown as vscode.QuickPickItem;
        }
        // Step 3: choose "Enter model manually..."
        return {
          label: "$(edit) Enter model manually...",
        } as unknown as vscode.QuickPickItem;
      }
    );

    let ibCall = 0;
    vi.spyOn(vscode.window, "showInputBox").mockImplementation(async () => {
      ibCall += 1;
      if (ibCall === 1) return "http://localhost:11434/v1"; // baseUrl
      if (ibCall === 2) return "qwen2.5-coder:7b"; // model (manual)
      if (ibCall === 3) return "sk-test-secret-123"; // api key
      return undefined;
    });

    const handler = commandHandlers.get("localCopilot.setupWizard");
    expect(handler).toBeDefined();
    await handler!();

    expect(spy.configurationUpdates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "provider", value: "ollama" }),
        expect.objectContaining({
          key: "baseUrl",
          value: "http://localhost:11434/v1",
        }),
        expect.objectContaining({ key: "model", value: "qwen2.5-coder:7b" }),
      ])
    );

    expect(await spy.secrets.get("localCopilot.apiKey.ollama")).toBe(
      "sk-test-secret-123"
    );
    expect(
      spy.informationMessages.some((m) => m.includes("connected"))
    ).toBe(true);
  });

  it("should abort setup wizard when a step is cancelled", async () => {
    await activate(mockContext as unknown as vscode.ExtensionContext);

    // Cancel immediately at the provider step
    vi.spyOn(vscode.window, "showQuickPick").mockResolvedValue(undefined);

    const handler = commandHandlers.get("localCopilot.setupWizard");
    expect(handler).toBeDefined();
    await handler!();

    expect(spy.configurationUpdates).toHaveLength(0);
  });

  it("should toggle localCopilot.enabled via localCopilot.toggle", async () => {
    await activate(mockContext as unknown as vscode.ExtensionContext);
    expect(spy.configurationUpdates).toHaveLength(0);

    const handler = commandHandlers.get("localCopilot.toggle");
    expect(handler).toBeDefined();
    await handler!();

    expect(spy.configurationUpdates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "enabled", value: false }),
      ])
    );
    expect(spy.informationMessages).toContain("Local Copilot disabled");
  });

  it("should open quick settings menu and apply a selected setting", async () => {
    await activate(mockContext as unknown as vscode.ExtensionContext);

    let call = 0;
    const showQuickPickSpy = vi
      .spyOn(vscode.window, "showQuickPick")
      .mockImplementation(async (items) => {
        call += 1;
        if (call === 1) {
          // Top-level menu: pick the "Local Only" setting
          const topLevel = items as Array<{ setting?: string }>;
          const localOnly = topLevel.find((i) => i.setting === "localOnly");
          return (localOnly ?? undefined) as unknown as vscode.QuickPickItem;
        }
        if (call === 2) {
          // Boolean value prompt: choose "true"
          return { label: "true", value: true } as unknown as vscode.QuickPickItem;
        }
        // Third call (back in the menu loop): exit
        return undefined;
      });

    const handler = commandHandlers.get("localCopilot.quickSettings");
    expect(handler).toBeDefined();
    await handler!();

    // top-level pick + boolean value prompt must have opened QuickPick twice
    expect(showQuickPickSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(spy.configurationUpdates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "localOnly", value: true }),
      ])
    );
    expect(
      spy.informationMessages.some((m) => m.includes("Local Only"))
    ).toBe(true);
  });

  it("should register inline completion item provider for all expanded languages", async () => {
    await activate(mockContext as unknown as vscode.ExtensionContext);
    expect(spy.inlineCompletionProviders).toHaveLength(1);

    const selector = spy.inlineCompletionProviders[0].selector as Array<{ language: string }>;
    const registeredLanguages = selector.map((s) => s.language);
    expect(registeredLanguages).toContain("typescript");
    expect(registeredLanguages).toContain("javascript");
    expect(registeredLanguages).toContain("typescriptreact");
    expect(registeredLanguages).toContain("javascriptreact");
    expect(registeredLanguages).toContain("python");
    expect(registeredLanguages).toContain("go");
    expect(registeredLanguages).toContain("rust");
    expect(registeredLanguages).toContain("java");
    expect(registeredLanguages).toContain("c");
    expect(registeredLanguages).toContain("cpp");
  });

  it("should open QuickPick with popular models and allow selecting a model", async () => {
    await activate(mockContext as unknown as vscode.ExtensionContext);

    let quickPickItems: Array<{ label: string }> = [];
    vi.spyOn(vscode.window, "showQuickPick").mockImplementation(async (items) => {
      quickPickItems = items as Array<{ label: string }>;
      return { label: "deepseek-coder:6.7b" } as unknown as vscode.QuickPickItem;
    });

    const handler = commandHandlers.get("localCopilot.selectModel");
    expect(handler).toBeDefined();
    await handler!();

    // Verify QuickPick opened with options
    expect(quickPickItems.length).toBeGreaterThanOrEqual(4);
    expect(quickPickItems.some((i) => i.label === "qwen2.5-coder:7b")).toBe(true);
    expect(quickPickItems.some((i) => i.label === "deepseek-coder:6.7b")).toBe(true);
    expect(quickPickItems.some((i) => i.label.includes("Enter model manually"))).toBe(true);

    // Verify config update occurred
    expect(spy.configurationUpdates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "model",
          value: "deepseek-coder:6.7b",
        }),
      ])
    );
  });

  it("should open input box when manual entry option is selected", async () => {
    await activate(mockContext as unknown as vscode.ExtensionContext);

    vi.spyOn(vscode.window, "showQuickPick").mockImplementation(async () => {
      return { label: "$(edit) Enter model manually..." } as unknown as vscode.QuickPickItem;
    });

    const showInputBoxSpy = vi
      .spyOn(vscode.window, "showInputBox")
      .mockResolvedValue("custom-local-model:latest");

    const handler = commandHandlers.get("localCopilot.selectModel");
    await handler!();

    expect(showInputBoxSpy).toHaveBeenCalled();
    expect(spy.configurationUpdates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "model",
          value: "custom-local-model:latest",
        }),
      ])
    );
  });

  it("should securely store API key via localCopilot.setApiKey", async () => {
    await activate(mockContext as unknown as vscode.ExtensionContext);

    vi.spyOn(vscode.window, "showInputBox").mockResolvedValue("sk-my-super-secret-key-12345");

    const handler = commandHandlers.get("localCopilot.setApiKey");
    expect(handler).toBeDefined();
    await handler!();

    const stored = await spy.secrets.get("localCopilot.apiKey.custom");
    expect(stored).toBe("sk-my-super-secret-key-12345");
  });

  it("should clear API key via localCopilot.deleteApiKey", async () => {
    await spy.secrets.store("localCopilot.apiKey.custom", "existing-secret");

    await activate(mockContext as unknown as vscode.ExtensionContext);

    const handler = commandHandlers.get("localCopilot.deleteApiKey");
    expect(handler).toBeDefined();
    await handler!();

    const stored = await spy.secrets.get("localCopilot.apiKey.custom");
    expect(stored).toBeUndefined();
  });

  it("should display masked API key in diagnostics webview panel", async () => {
    await spy.secrets.store("localCopilot.apiKey.custom", "sk-1234567890abcdef");

    await activate(mockContext as unknown as vscode.ExtensionContext);

    const handler = commandHandlers.get("localCopilot.showDiagnostics");
    expect(handler).toBeDefined();
    await handler!();

    // Diagnostics opens a real-time webview panel instead of a modal dialog
    expect(spy.webviewPanels).toHaveLength(1);
    expect(spy.webviewPanels[0].viewType).toBe("localCopilot.diagnostics");

    const html = spy.webviewPanels[0].webview.html;
    expect(html).toContain("sk-...cdef");
    expect(html).not.toContain("sk-1234567890abcdef");
  });

  it("should open diagnostics webview when localCopilot.viewMetrics is executed", async () => {
    await activate(mockContext as unknown as vscode.ExtensionContext);

    const handler = commandHandlers.get("localCopilot.viewMetrics");
    expect(handler).toBeDefined();
    await handler!();

    expect(spy.webviewPanels).toHaveLength(1);
    expect(spy.webviewPanels[0].viewType).toBe("localCopilot.diagnostics");
  });

  it("should handle localCopilot.completionAccepted and localCopilot.resetMetrics", async () => {
    await activate(mockContext as unknown as vscode.ExtensionContext);

    const acceptHandler = commandHandlers.get("localCopilot.completionAccepted");
    expect(acceptHandler).toBeDefined();
    await acceptHandler!({
      text: "const x = 10;",
      language: "typescript",
      latencyMs: 100,
    });

    const resetHandler = commandHandlers.get("localCopilot.resetMetrics");
    expect(resetHandler).toBeDefined();
    await resetHandler!();

    expect(spy.informationMessages).toContain("Completion metrics reset");
  });
});
