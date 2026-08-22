import * as vscode from "vscode";
import type { ProviderConfig } from "@local-copilot/shared";

const CONFIG_SECTION = "localCopilot";

/**
 * Reads the current Local Copilot configuration from VS Code settings.
 */
export function getConfiguration(): ProviderConfig {
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);

  return {
    enabled: config.get<boolean>("enabled", true),
    provider: config.get<ProviderConfig["provider"]>("provider", "custom"),
    baseUrl: config.get<string>("baseUrl", "http://localhost:11434/v1"),
    apiKey: config.get<string>("apiKey", ""),
    model: config.get<string>("model", ""),
    debounceMs: config.get<number>("debounceMs", 150),
    requestTimeoutMs: config.get<number>("requestTimeoutMs", 2000),
    maxOutputTokens: config.get<number>("maxOutputTokens", 128),
    temperature: config.get<number>("temperature", 0.1),
    contextMaxLines: config.get<number>("context.maxLines", 120),
    localOnly: config.get<boolean>("localOnly", true),
    telemetryEnabled: config.get<boolean>("telemetry.enabled", false),
  };
}

/**
 * Creates a VS Code configuration change listener for Local Copilot settings.
 */
export function onConfigurationChanged(
  callback: (config: ProviderConfig) => void
): vscode.Disposable {
  return vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration(CONFIG_SECTION)) {
      callback(getConfiguration());
    }
  });
}
