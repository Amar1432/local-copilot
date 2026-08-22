import { describe, it, expect, vi, beforeEach } from "vitest";
import * as vscode from "vscode";
import { activate } from "./extension";
import { resetMocks, spy } from "../__mocks__/vscode";

describe("Extension Commands & selectModel", () => {
  let mockContext: { subscriptions: Array<{ dispose: () => void }> };
  let commandHandlers: Map<string, (...args: unknown[]) => Promise<unknown> | unknown>;

  beforeEach(() => {
    resetMocks();
    commandHandlers = new Map();
    mockContext = { subscriptions: [] };

    // Capture registered command callbacks
    vi.spyOn(vscode.commands, "registerCommand").mockImplementation(
      (command: string, callback: (...args: unknown[]) => unknown) => {
        commandHandlers.set(command, callback);
        return new (vscode as unknown as { MockDisposable: new () => { dispose: () => void } }).MockDisposable();
      }
    );
  });

  it("should activate and register localCopilot.selectModel command", () => {
    activate(mockContext as unknown as vscode.ExtensionContext);
    expect(commandHandlers.has("localCopilot.selectModel")).toBe(true);
    expect(commandHandlers.has("localCopilot.selectProvider")).toBe(true);
    expect(commandHandlers.has("localCopilot.testConnection")).toBe(true);
    expect(commandHandlers.has("localCopilot.showDiagnostics")).toBe(true);
  });

  it("should open QuickPick with popular models and allow selecting a model", async () => {
    activate(mockContext as unknown as vscode.ExtensionContext);

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
    activate(mockContext as unknown as vscode.ExtensionContext);

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
});
