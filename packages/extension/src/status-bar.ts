import * as vscode from "vscode";
import type { ConnectionStatus } from "@local-copilot/shared";

/**
 * Manages the status bar item that shows the current connection state.
 *
 * States:
 * - "AI: Local"     — local provider connected
 * - "AI: Cloud"     — cloud provider connected
 * - "AI: Offline"   — no connection
 * - "AI: Local Only"— local-only mode enabled
 */
export class StatusBarManager implements vscode.Disposable {
  private readonly item: vscode.StatusBarItem;
  private status: ConnectionStatus = "disconnected";
  private localOnly = true;

  constructor() {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.item.command = "localCopilot.openSettings";
    this.item.tooltip = "Local Copilot — Click to open settings";
    this.updateText();
    this.show();
  }

  /**
   * Update the connection status and refresh the status bar text.
   */
  setStatus(status: ConnectionStatus, localOnly: boolean): void {
    this.status = status;
    this.localOnly = localOnly;
    this.updateText();
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
    if (this.localOnly) {
      if (this.status === "connected") {
        this.item.text = "$(plug) AI: Local Only";
        this.item.color = undefined;
        this.item.tooltip = "Local Copilot — Local Only (connected)";
      } else if (this.status === "checking") {
        this.item.text = "$(sync~spin) AI: Checking...";
        this.item.color = undefined;
        this.item.tooltip = "Local Copilot — Checking connection...";
      } else {
        this.item.text = "$(warning) AI: Local Only";
        this.item.color = new vscode.ThemeColor("statusBarItem.warningForeground");
        this.item.tooltip = "Local Copilot — Local Only (disconnected)";
      }
    } else {
      if (this.status === "connected") {
        this.item.text = "$(check) AI: Connected";
        this.item.color = undefined;
        this.item.tooltip = "Local Copilot — Connected";
      } else if (this.status === "checking") {
        this.item.text = "$(sync~spin) AI: Checking...";
        this.item.color = undefined;
        this.item.tooltip = "Local Copilot — Checking connection...";
      } else {
        this.item.text = "$(x) AI: Offline";
        this.item.color = new vscode.ThemeColor("statusBarItem.errorForeground");
        this.item.tooltip = "Local Copilot — Disconnected";
      }
    }
  }

  dispose(): void {
    this.item.dispose();
  }
}
