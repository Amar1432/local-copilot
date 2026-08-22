import * as vscode from "vscode";
import { getConfiguration, onConfigurationChanged } from "./configuration";
import { StatusBarManager } from "./status-bar";
import { LocalCopilotCompletionProvider } from "./completion-provider";
import { ModelDiscoveryService } from "@local-copilot/core";

let statusBar: StatusBarManager | undefined;
let completionProvider: LocalCopilotCompletionProvider | undefined;

/**
 * Called when the extension is activated.
 *
 * Activation is triggered by the `activationEvents` in package.json
 * (onLanguage: typescript, javascript, typescriptreact, javascriptreact).
 */
export function activate(context: vscode.ExtensionContext): void {
  const config = getConfiguration();

  // Status bar
  statusBar = new StatusBarManager();
  statusBar.setStatus("disconnected", config.localOnly);
  context.subscriptions.push(statusBar);

  // Completion provider
  completionProvider = new LocalCopilotCompletionProvider(config);
  registerCompletionProvider(context, completionProvider);

  // Commands
  registerCommands(context, statusBar);

  // Listen for configuration changes
  context.subscriptions.push(
    onConfigurationChanged((newConfig) => {
      completionProvider?.updateConfig(newConfig);
      statusBar?.setStatus("disconnected", newConfig.localOnly);
    })
  );

  console.log("Local Copilot activated.");
}

/**
 * Called when the extension is deactivated.
 */
export function deactivate(): void {
  completionProvider?.dispose();
  statusBar = undefined;
  completionProvider = undefined;
  console.log("Local Copilot deactivated.");
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

function registerCommands(context: vscode.ExtensionContext, status: StatusBarManager): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("localCopilot.enable", async () => {
      const config = vscode.workspace.getConfiguration("localCopilot");
      await config.update("enabled", true, vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage("Local Copilot enabled");
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("localCopilot.disable", async () => {
      const config = vscode.workspace.getConfiguration("localCopilot");
      await config.update("enabled", false, vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage("Local Copilot disabled");
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("localCopilot.triggerCompletion", () => {
      vscode.commands.executeCommand("editor.action.triggerSuggest");
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("localCopilot.selectModel", async () => {
      const config = getConfiguration();
      const discovery = new ModelDiscoveryService();

      let discoveredModels: Array<{ label: string; description?: string; detail?: string }> = [];
      try {
        const models = await discovery.discoverModels(config);
        discoveredModels = models.map((m) => ({
          label: m.id,
          description: `${m.capabilities.fim ? "FIM" : "No FIM"} • ${config.localOnly ? "local" : "remote"}`,
          detail: m.name !== m.id ? m.name : undefined,
        }));
      } catch {
        // Fallback to manual entry if discovery fails
      }

      if (discoveredModels.length > 0) {
        const manualOption = {
          label: "$(edit) Enter model manually...",
          description: "Type custom model identifier",
        };
        const items = [...discoveredModels, manualOption];

        const selected = await vscode.window.showQuickPick(items, {
          placeHolder: `Select a model (currently: ${config.model || "none"})`,
        });

        if (!selected) return;

        if (selected === manualOption) {
          const custom = await vscode.window.showInputBox({
            prompt: "Enter model identifier",
            placeHolder: "e.g. qwen-coder, deepseek-coder",
            value: config.model,
          });
          if (custom !== undefined) {
            const cfg = vscode.workspace.getConfiguration("localCopilot");
            await cfg.update("model", custom, vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage(`Model set to: ${custom}`);
          }
        } else {
          const cfg = vscode.workspace.getConfiguration("localCopilot");
          await cfg.update("model", selected.label, vscode.ConfigurationTarget.Global);
          vscode.window.showInformationMessage(`Model set to: ${selected.label}`);
        }
      } else {
        const model = await vscode.window.showInputBox({
          prompt: "Enter model identifier",
          placeHolder: "e.g. qwen-coder, deepseek-coder",
          value: config.model,
        });
        if (model !== undefined) {
          const cfg = vscode.workspace.getConfiguration("localCopilot");
          await cfg.update("model", model, vscode.ConfigurationTarget.Global);
          vscode.window.showInformationMessage(`Model set to: ${model}`);
        }
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("localCopilot.selectProvider", async () => {
      const items = [
        { label: "custom", description: "Custom OpenAI-compatible endpoint" },
        { label: "ollama", description: "Ollama local runtime" },
        { label: "openai", description: "OpenAI API" },
        { label: "lmstudio", description: "LM Studio local runtime" },
        { label: "vllm", description: "vLLM inference server" },
      ];
      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: "Select a provider",
      });
      if (selected) {
        const cfg = vscode.workspace.getConfiguration("localCopilot");
        await cfg.update("provider", selected.label, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(`Provider set to: ${selected.label}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("localCopilot.testConnection", async () => {
      status.setStatus("checking", getConfiguration().localOnly);
      vscode.window.showInformationMessage("Testing connection...");
      try {
        const connected = await completionProvider?.orchestratorInstance.testProviderConnection();
        if (connected) {
          status.setStatus("connected", getConfiguration().localOnly);
          vscode.window.showInformationMessage("Connection successful!");
        } else {
          status.setStatus("disconnected", getConfiguration().localOnly);
          vscode.window.showErrorMessage("Connection failed. Check your provider settings.");
        }
      } catch {
        status.setStatus("disconnected", getConfiguration().localOnly);
        vscode.window.showErrorMessage("Connection test failed.");
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("localCopilot.showDiagnostics", () => {
      const config = getConfiguration();
      const stats = completionProvider?.orchestratorInstance.cacheStats;
      const info = [
        `Provider: ${config.provider}`,
        `Model: ${config.model || "(not set)"}`,
        `Base URL: ${config.baseUrl}`,
        `Local Only: ${config.localOnly ? "Yes" : "No"}`,
        `Debounce: ${config.debounceMs}ms`,
        `Timeout: ${config.requestTimeoutMs}ms`,
        `Max Tokens: ${config.maxOutputTokens}`,
        `Temperature: ${config.temperature}`,
        stats
          ? `Cache: ${stats.size}/${stats.maxSize} entries (Hits: ${stats.hits}, Misses: ${stats.misses})`
          : "Cache: N/A",
      ].join("\n");
      vscode.window.showInformationMessage(info, { modal: true });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("localCopilot.clearCache", () => {
      completionProvider?.clearCache();
      vscode.window.showInformationMessage("Cache cleared");
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("localCopilot.openSettings", () => {
      vscode.commands.executeCommand("workbench.action.openSettings", "localCopilot");
    })
  );
}

// ---------------------------------------------------------------------------
// Completion Provider
// ---------------------------------------------------------------------------

function registerCompletionProvider(
  context: vscode.ExtensionContext,
  provider: LocalCopilotCompletionProvider
): void {
  const selector: vscode.DocumentSelector = [
    { language: "typescript" },
    { language: "javascript" },
    { language: "typescriptreact" },
    { language: "javascriptreact" },
  ];

  context.subscriptions.push(
    vscode.languages.registerInlineCompletionItemProvider(selector, provider)
  );
}
