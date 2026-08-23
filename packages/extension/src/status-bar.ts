import * as vscode from "vscode";
import type { ConnectionStatus } from "@local-copilot/shared";

/**
 * State options for the status bar manager.
 */
export interface StatusBarState {
  status: ConnectionStatus;
  localOnly: boolean;
  model?: string;
  provider?: string;
  latencyMs?: number | null;
  enabled?: boolean;
}

/**
 * Manages the status bar item that shows the current connection state,
 * active model name, request latency, and action menu.
 *
 * States:
 * - "AI: Local"     — local provider connected (optionally with model & latency)
 * - "AI: Cloud"     — cloud provider connected (optionally with model & latency)
 * - "AI: Offline"   — no connection
 * - "AI: Local Only"— local-only mode enabled
 * - "AI: Disabled"  — extension disabled
 */
export class StatusBarManager implements vscode.Disposable {
  private readonly item: vscode.StatusBarItem;
  private status: ConnectionStatus = "disconnected";
  private localOnly = true;
  private model?: string;
  private provider?: string;
  private latencyMs: number | null = null;
  private enabled = true;

  constructor(initialState?: Partial<StatusBarState>) {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.item.command = "localCopilot.statusBarMenu";
    this.item.tooltip = "Local Copilot — Click to open menu";

    if (initialState) {
      if (initialState.status !== undefined) this.status = initialState.status;
      if (initialState.localOnly !== undefined) this.localOnly = initialState.localOnly;
      if (initialState.model !== undefined) this.model = initialState.model;
      if (initialState.provider !== undefined) this.provider = initialState.provider;
      if (initialState.latencyMs !== undefined) this.latencyMs = initialState.latencyMs;
      if (initialState.enabled !== undefined) this.enabled = initialState.enabled;
    }

    this.updateText();
    this.show();
  }

  /**
   * Update the connection status and refresh the status bar text.
   * Maintains backward compatibility while supporting model and latencyMs.
   */
  setStatus(
    status: ConnectionStatus,
    localOnly: boolean,
    model?: string,
    latencyMs?: number | null
  ): void {
    this.status = status;
    this.localOnly = localOnly;
    if (model !== undefined) this.model = model;
    if (latencyMs !== undefined) this.latencyMs = latencyMs;
    this.updateText();
  }

  /**
   * Update multiple state fields at once.
   */
  update(state: Partial<StatusBarState>): void {
    if (state.status !== undefined) this.status = state.status;
    if (state.localOnly !== undefined) this.localOnly = state.localOnly;
    if (state.model !== undefined) this.model = state.model;
    if (state.provider !== undefined) this.provider = state.provider;
    if (state.latencyMs !== undefined) this.latencyMs = state.latencyMs;
    if (state.enabled !== undefined) this.enabled = state.enabled;
    this.updateText();
  }

  /**
   * Update the latency indicator from the last completion.
   */
  setLatency(latencyMs: number | null): void {
    this.latencyMs = latencyMs;
    this.updateText();
  }

  /**
   * Update the active model identifier.
   */
  setModel(model: string): void {
    this.model = model;
    this.updateText();
  }

  /**
   * Update the active provider identifier.
   */
  setProvider(provider: string): void {
    this.provider = provider;
    this.updateText();
  }

  /**
   * Update the extension enabled state.
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.updateText();
  }

  /**
   * Get the current status bar state snapshot.
   */
  getState(): Readonly<StatusBarState> {
    return {
      status: this.status,
      localOnly: this.localOnly,
      model: this.model,
      provider: this.provider,
      latencyMs: this.latencyMs,
      enabled: this.enabled,
    };
  }

  /**
   * Show the status bar item.
   */
  show(): void {
    this.item.show();
  }

  /**
   * Hide the status bar item.
   */
  hide(): void {
    this.item.hide();
  }

  private updateText(): void {
    if (!this.enabled) {
      this.item.text = "$(circle-slash) AI: Disabled";
      this.item.color = new vscode.ThemeColor("statusBarItem.warningForeground");
      this.item.tooltip = "Local Copilot — Disabled";
      return;
    }

    let baseTooltip = "";

    if (this.localOnly) {
      if (this.status === "connected") {
        if (this.model) {
          this.item.text =
            this.latencyMs != null
              ? `$(plug) AI: Local (${this.model}) (${this.latencyMs}ms)`
              : `$(plug) AI: Local (${this.model})`;
        } else {
          this.item.text = "$(plug) AI: Local Only";
        }
        this.item.color = undefined;
        baseTooltip = "Local Copilot — Local Only (connected)";
      } else if (this.status === "checking") {
        this.item.text = "$(sync~spin) AI: Checking...";
        this.item.color = undefined;
        baseTooltip = "Local Copilot — Checking connection...";
      } else {
        this.item.text = this.model
          ? `$(warning) AI: Local Only (${this.model})`
          : "$(warning) AI: Local Only";
        this.item.color = new vscode.ThemeColor("statusBarItem.warningForeground");
        baseTooltip = "Local Copilot — Local Only (disconnected)";
      }
    } else {
      if (this.status === "connected") {
        if (this.model) {
          this.item.text =
            this.latencyMs != null
              ? `$(check) AI: Connected (${this.model}) (${this.latencyMs}ms)`
              : `$(check) AI: Connected (${this.model})`;
        } else {
          this.item.text = "$(check) AI: Connected";
        }
        this.item.color = undefined;
        baseTooltip = "Local Copilot — Connected";
      } else if (this.status === "checking") {
        this.item.text = "$(sync~spin) AI: Checking...";
        this.item.color = undefined;
        baseTooltip = "Local Copilot — Checking connection...";
      } else {
        this.item.text = this.model
          ? `$(x) AI: Offline (${this.model})`
          : "$(x) AI: Offline";
        this.item.color = new vscode.ThemeColor("statusBarItem.errorForeground");
        baseTooltip = "Local Copilot — Disconnected";
      }
    }

    const tooltipLines = [baseTooltip];
    if (this.provider) {
      tooltipLines.push(`Provider: ${this.provider}`);
    }
    if (this.model) {
      tooltipLines.push(`Model: ${this.model}`);
    }
    if (this.latencyMs !== null && this.latencyMs !== undefined) {
      tooltipLines.push(`Latency: ${this.latencyMs}ms`);
    }

    this.item.tooltip = tooltipLines.join("\n");
  }

  dispose(): void {
    this.item.dispose();
  }
}

/**
 * Present an interactive QuickPick menu with common Local Copilot actions.
 */
export async function showStatusBarQuickMenu(): Promise<void> {
  const config = vscode.workspace.getConfiguration("localCopilot");
  const isEnabled = config.get<boolean>("enabled", true);
  const currentModel = config.get<string>("model", "");
  const currentProvider = config.get<string>("provider", "custom");

  const items = [
    {
      label: isEnabled ? "$(circle-slash) Disable Local Copilot" : "$(check) Enable Local Copilot",
      description: isEnabled ? "Currently enabled" : "Currently disabled",
      action: async () => {
        await vscode.commands.executeCommand(
          isEnabled ? "localCopilot.disable" : "localCopilot.enable"
        );
      },
    },
    {
      label: "$(symbol-misc) Select Model...",
      description: currentModel ? `Current: ${currentModel}` : "None configured",
      detail: "Select or specify active completion model",
      action: async () => {
        await vscode.commands.executeCommand("localCopilot.selectModel");
      },
    },
    {
      label: "$(server) Select Provider...",
      description: `Current: ${currentProvider}`,
      detail: "Switch provider runtime (custom, ollama, openai, lmstudio, vllm)",
      action: async () => {
        await vscode.commands.executeCommand("localCopilot.selectProvider");
      },
    },
    {
      label: "$(key) Set API Key...",
      description: "Store provider API key securely in SecretStorage",
      action: async () => {
        await vscode.commands.executeCommand("localCopilot.setApiKey");
      },
    },
    {
      label: "$(refresh) Test Connection",
      description: "Verify provider endpoint responsiveness",
      action: async () => {
        await vscode.commands.executeCommand("localCopilot.testConnection");
      },
    },
    {
      label: "$(graph) Show Diagnostics",
      description: "Open real-time webview diagnostics panel",
      action: async () => {
        await vscode.commands.executeCommand("localCopilot.showDiagnostics");
      },
    },
    {
      label: "$(trash) Clear Cache",
      description: "Clear completion request cache",
      action: async () => {
        await vscode.commands.executeCommand("localCopilot.clearCache");
      },
    },
    {
      label: "$(gear) Open Settings",
      description: "Configure all Local Copilot extension settings",
      action: async () => {
        await vscode.commands.executeCommand("localCopilot.openSettings");
      },
    },
  ];

  const selected = (await vscode.window.showQuickPick(items, {
    placeHolder: "Local Copilot — Quick Actions",
  })) as (typeof items)[number] | undefined;

  if (selected) {
    await selected.action();
  }
}

