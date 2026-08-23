import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as vscode from "vscode";
import { StatusBarManager, showStatusBarQuickMenu } from "./status-bar";
import { spy, resetMocks } from "../__mocks__/vscode";

describe("StatusBarManager", () => {
  let statusBar: StatusBarManager;

  beforeEach(() => {
    resetMocks();
    statusBar = new StatusBarManager();
  });

  afterEach(() => {
    statusBar.dispose();
    resetMocks();
  });

  // -----------------------------------------------------------------------
  // Basic lifecycle
  // -----------------------------------------------------------------------

  it("should create a status bar item on construction", () => {
    expect(spy.statusBarItem).not.toBeNull();
  });

  it("should show the status bar item on construction", () => {
    expect(spy.statusBarItem?.visible).toBe(true);
  });

  it("should assign localCopilot.statusBarMenu as the default command", () => {
    expect(spy.statusBarItem?.command).toBe("localCopilot.statusBarMenu");
  });

  it("should have a dispose method", () => {
    expect(typeof statusBar.dispose).toBe("function");
  });

  it("should initialize with custom options when provided", () => {
    const custom = new StatusBarManager({
      status: "connected",
      localOnly: true,
      model: "qwen-coder",
      provider: "ollama",
      latencyMs: 120,
    });
    expect(spy.statusBarItem?.text).toBe("$(plug) AI: Local (qwen-coder) (120ms)");
    expect(custom.getState().model).toBe("qwen-coder");
    expect(custom.getState().latencyMs).toBe(120);
    custom.dispose();
  });

  // -----------------------------------------------------------------------
  // Show / Hide
  // -----------------------------------------------------------------------

  describe("show/hide", () => {
    it("should show when show() is called", () => {
      statusBar.hide();
      expect(spy.statusBarItem?.visible).toBe(false);
      statusBar.show();
      expect(spy.statusBarItem?.visible).toBe(true);
    });

    it("should hide when hide() is called", () => {
      statusBar.hide();
      expect(spy.statusBarItem?.visible).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Status updates — local only
  // -----------------------------------------------------------------------

  describe("local-only mode", () => {
    it('should display "AI: Local Only" when connected and local-only without model', () => {
      statusBar.setStatus("connected", true);
      expect(spy.statusBarItem?.text).toBe("$(plug) AI: Local Only");
    });

    it('should display model name when connected and local-only with model', () => {
      statusBar.setStatus("connected", true, "qwen-coder");
      expect(spy.statusBarItem?.text).toBe("$(plug) AI: Local (qwen-coder)");
    });

    it('should display model name and latency when connected and local-only with model and latency', () => {
      statusBar.setStatus("connected", true, "qwen-coder", 145);
      expect(spy.statusBarItem?.text).toBe("$(plug) AI: Local (qwen-coder) (145ms)");
    });

    it('should display "AI: Checking..." when checking and local-only', () => {
      statusBar.setStatus("checking", true);
      expect(spy.statusBarItem?.text).toBe("$(sync~spin) AI: Checking...");
    });

    it('should display "AI: Local Only" warning when disconnected and local-only without model', () => {
      statusBar.setStatus("disconnected", true);
      expect(spy.statusBarItem?.text).toBe("$(warning) AI: Local Only");
    });

    it('should display warning with model when disconnected and local-only with model', () => {
      statusBar.setStatus("disconnected", true, "qwen-coder");
      expect(spy.statusBarItem?.text).toBe("$(warning) AI: Local Only (qwen-coder)");
    });
  });

  // -----------------------------------------------------------------------
  // Status updates — remote enabled
  // -----------------------------------------------------------------------

  describe("remote-enabled mode", () => {
    it('should display "AI: Connected" when connected and not local-only without model', () => {
      statusBar.setStatus("connected", false);
      expect(spy.statusBarItem?.text).toBe("$(check) AI: Connected");
    });

    it('should display model name when connected and not local-only with model', () => {
      statusBar.setStatus("connected", false, "gpt-4o");
      expect(spy.statusBarItem?.text).toBe("$(check) AI: Connected (gpt-4o)");
    });

    it('should display model name and latency when connected and not local-only with latency', () => {
      statusBar.setStatus("connected", false, "gpt-4o", 280);
      expect(spy.statusBarItem?.text).toBe("$(check) AI: Connected (gpt-4o) (280ms)");
    });

    it('should display "AI: Checking..." when checking and not local-only', () => {
      statusBar.setStatus("checking", false);
      expect(spy.statusBarItem?.text).toBe("$(sync~spin) AI: Checking...");
    });

    it('should display "AI: Offline" when disconnected and not local-only without model', () => {
      statusBar.setStatus("disconnected", false);
      expect(spy.statusBarItem?.text).toBe("$(x) AI: Offline");
    });

    it('should display offline with model when disconnected and not local-only with model', () => {
      statusBar.setStatus("disconnected", false, "gpt-4o");
      expect(spy.statusBarItem?.text).toBe("$(x) AI: Offline (gpt-4o)");
    });
  });

  // -----------------------------------------------------------------------
  // Disabled state
  // -----------------------------------------------------------------------

  describe("disabled state", () => {
    it('should display "AI: Disabled" when enabled is false', () => {
      statusBar.setEnabled(false);
      expect(spy.statusBarItem?.text).toBe("$(circle-slash) AI: Disabled");
      expect(spy.statusBarItem?.tooltip).toBe("Local Copilot — Disabled");
    });

    it("should restore normal text when re-enabled", () => {
      statusBar.setEnabled(false);
      expect(spy.statusBarItem?.text).toBe("$(circle-slash) AI: Disabled");
      statusBar.setEnabled(true);
      expect(spy.statusBarItem?.text).toBe("$(warning) AI: Local Only");
    });
  });

  // -----------------------------------------------------------------------
  // State update methods
  // -----------------------------------------------------------------------

  describe("state update methods", () => {
    it("should update multiple fields with update()", () => {
      statusBar.update({
        status: "connected",
        localOnly: true,
        model: "deepseek-coder",
        provider: "ollama",
        latencyMs: 95,
      });

      expect(spy.statusBarItem?.text).toBe("$(plug) AI: Local (deepseek-coder) (95ms)");
      const state = statusBar.getState();
      expect(state.status).toBe("connected");
      expect(state.localOnly).toBe(true);
      expect(state.model).toBe("deepseek-coder");
      expect(state.provider).toBe("ollama");
      expect(state.latencyMs).toBe(95);
    });

    it("should update latency with setLatency()", () => {
      statusBar.setStatus("connected", true, "qwen-coder");
      expect(spy.statusBarItem?.text).toBe("$(plug) AI: Local (qwen-coder)");

      statusBar.setLatency(175);
      expect(spy.statusBarItem?.text).toBe("$(plug) AI: Local (qwen-coder) (175ms)");

      statusBar.setLatency(null);
      expect(spy.statusBarItem?.text).toBe("$(plug) AI: Local (qwen-coder)");
    });

    it("should update model with setModel()", () => {
      statusBar.setStatus("connected", true);
      statusBar.setModel("starcoder2:3b");
      expect(spy.statusBarItem?.text).toBe("$(plug) AI: Local (starcoder2:3b)");
    });

    it("should update provider with setProvider()", () => {
      statusBar.setProvider("lmstudio");
      expect(statusBar.getState().provider).toBe("lmstudio");
    });
  });

  // -----------------------------------------------------------------------
  // Tooltip
  // -----------------------------------------------------------------------

  describe("tooltip", () => {
    it("should set appropriate base tooltip for local-only connected", () => {
      statusBar.setStatus("connected", true);
      expect(spy.statusBarItem?.tooltip).toBe("Local Copilot — Local Only (connected)");
    });

    it("should set appropriate base tooltip for remote connected", () => {
      statusBar.setStatus("connected", false);
      expect(spy.statusBarItem?.tooltip).toBe("Local Copilot — Connected");
    });

    it("should set appropriate base tooltip for offline", () => {
      statusBar.setStatus("disconnected", false);
      expect(spy.statusBarItem?.tooltip).toBe("Local Copilot — Disconnected");
    });

    it("should include provider, model, and latency in rich tooltip when provided", () => {
      statusBar.update({
        status: "connected",
        localOnly: true,
        provider: "ollama",
        model: "qwen-coder",
        latencyMs: 142,
      });

      const tooltip = spy.statusBarItem?.tooltip ?? "";
      expect(tooltip).toContain("Local Copilot — Local Only (connected)");
      expect(tooltip).toContain("Provider: ollama");
      expect(tooltip).toContain("Model: qwen-coder");
      expect(tooltip).toContain("Latency: 142ms");
    });
  });

  // -----------------------------------------------------------------------
  // Dispose
  // -----------------------------------------------------------------------

  describe("dispose", () => {
    it("should dispose the underlying status bar item", () => {
      statusBar.dispose();
      expect(spy.statusBarItem?.disposed).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Quick Menu
  // -----------------------------------------------------------------------

  describe("showStatusBarQuickMenu", () => {
    it("should open QuickPick with options and trigger selected action", async () => {
      let quickPickItems: Array<{ label: string; action: () => Promise<void> | void }> = [];
      vi.spyOn(vscode.window, "showQuickPick").mockImplementation(async (items) => {
        quickPickItems = items as typeof quickPickItems;
        return quickPickItems[0];
      });

      const executeCommandSpy = vi.spyOn(vscode.commands, "executeCommand");

      await showStatusBarQuickMenu();

      expect(quickPickItems.length).toBeGreaterThanOrEqual(7);
      expect(quickPickItems.some((i) => i.label.includes("Select Model"))).toBe(true);
      expect(quickPickItems.some((i) => i.label.includes("Select Provider"))).toBe(true);
      expect(quickPickItems.some((i) => i.label.includes("Test Connection"))).toBe(true);
      expect(quickPickItems.some((i) => i.label.includes("Show Diagnostics"))).toBe(true);
      expect(quickPickItems.some((i) => i.label.includes("Clear Cache"))).toBe(true);
      expect(quickPickItems.some((i) => i.label.includes("Open Settings"))).toBe(true);

      expect(executeCommandSpy).toHaveBeenCalledWith("localCopilot.disable");
    });
  });
});

