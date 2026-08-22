import * as vscode from "vscode";
import type { ProviderConfig } from "@local-copilot/shared";
import { getConfiguration, onConfigurationChanged } from "./configuration";
import { StatusBarManager } from "./status-bar";
import { LocalCopilotCompletionProvider } from "./completion-provider";
import { SecretManager } from "./secret-manager";
import { ModelDiscoveryService } from "@local-copilot/core";

let statusBar: StatusBarManager | undefined;
let completionProvider: LocalCopilotCompletionProvider | undefined;
let secretManager: SecretManager | undefined;

/**
 * Retrieve effective configuration with securely retrieved API key.
 */
async function getEffectiveConfig(secrets?: SecretManager): Promise<ProviderConfig> {
  const baseConfig = getConfiguration();
  if (!secrets) {
    return baseConfig;
  }
  const apiKey = await secrets.getApiKey(baseConfig.provider, baseConfig.apiKey);
  return {
    ...baseConfig,
    apiKey,
  };
}

/**
 * Called when the extension is activated.
 *
 * Activation is triggered by the `activationEvents` in package.json
 * (onLanguage: typescript, javascript, typescriptreact, javascriptreact).
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  // Initialize SecretManager
  secretManager = new SecretManager(context.secrets);

  // Load effective configuration
  const config = await getEffectiveConfig(secretManager);

  // Status bar
  statusBar = new StatusBarManager();
  statusBar.setStatus("disconnected", config.localOnly);
  context.subscriptions.push(statusBar);

  // Completion provider
  completionProvider = new LocalCopilotCompletionProvider(config);
  registerCompletionProvider(context, completionProvider);

  // Commands
  registerCommands(context, statusBar, secretManager);

  // Listen for configuration changes
  context.subscriptions.push(
    onConfigurationChanged(async (newConfig) => {
      const effective = await getEffectiveConfig(secretManager);
      completionProvider?.updateConfig(effective);
      statusBar?.setStatus("disconnected", newConfig.localOnly);
    })
  );

  // Listen for secret changes
  if (context.secrets && context.secrets.onDidChange) {
    context.subscriptions.push(
      context.secrets.onDidChange(async () => {
        const effective = await getEffectiveConfig(secretManager);
        completionProvider?.updateConfig(effective);
      })
    );
  }

  console.log("Local Copilot activated.");
}

/**
 * Called when the extension is deactivated.
 */
export function deactivate(): void {
  completionProvider?.dispose();
  statusBar = undefined;
  completionProvider = undefined;
  secretManager = undefined;
  console.log("Local Copilot deactivated.");
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

function registerCommands(
  context: vscode.ExtensionContext,
  status: StatusBarManager,
  secrets: SecretManager
): void {
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
    vscode.commands.registerCommand("localCopilot.setApiKey", async () => {
      const config = getConfiguration();
      const apiKey = await vscode.window.showInputBox({
        password: true,
        prompt: `Enter API key for provider '${config.provider}'`,
        placeHolder: "sk-...",
        ignoreFocusOut: true,
      });

      if (apiKey !== undefined) {
        await secrets.setApiKey(apiKey, config.provider);
        const effective = await getEffectiveConfig(secrets);
        completionProvider?.updateConfig(effective);
        vscode.window.showInformationMessage(
          apiKey ? "API key saved securely in SecretStorage." : "API key cleared."
        );
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("localCopilot.deleteApiKey", async () => {
      const config = getConfiguration();
      await secrets.deleteApiKey(config.provider);
      const effective = await getEffectiveConfig(secrets);
      completionProvider?.updateConfig(effective);
      vscode.window.showInformationMessage(`API key for '${config.provider}' cleared.`);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("localCopilot.selectModel", async () => {
      const config = await getEffectiveConfig(secrets);
      const discovery = new ModelDiscoveryService();

      const popularModels = [
        {
          label: "qwen2.5-coder:7b",
          description: "FIM • local",
          detail: "Qwen 2.5 Coder (Recommended local model)",
        },
        {
          label: "deepseek-coder:6.7b",
          description: "FIM • local",
          detail: "DeepSeek Coder 6.7B Instruct",
        },
        {
          label: "starcoder2:3b",
          description: "FIM • local",
          detail: "StarCoder2 3B (Lightweight)",
        },
        {
          label: "codellama:7b",
          description: "FIM • local",
          detail: "Code Llama 7B",
        },
      ];

      // Try discovering live models from the provider endpoint
      let liveModelItems: Array<{ label: string; description?: string; detail?: string }> = [];
      try {
        const models = await discovery.discoverModels(config);
        liveModelItems = models
          .filter((m) => !popularModels.some((p) => p.label === m.id))
          .map((m) => ({
            label: m.id,
            description: `${m.capabilities.fim ? "FIM" : "No FIM"} • ${config.localOnly ? "local" : "remote"}`,
            detail: m.name !== m.id ? m.name : "Discovered from endpoint",
          }));
      } catch {
        // Discovery endpoint offline or unreachable
      }

      const manualOption = {
        label: "$(edit) Enter model manually...",
        description: "Type custom model identifier",
        detail: "Provide any custom model name or HuggingFace ID",
      };

      const quickPickItems = [
        ...liveModelItems,
        ...popularModels,
        manualOption,
      ];

      const selected = await vscode.window.showQuickPick(quickPickItems, {
        placeHolder: `Select a model (currently: ${config.model || "none"})`,
        matchOnDescription: true,
        matchOnDetail: true,
      });

      if (!selected) return;

      if (selected.label === manualOption.label) {
        const custom = await vscode.window.showInputBox({
          prompt: "Enter model identifier",
          placeHolder: "e.g. qwen-coder, deepseek-coder",
          value: config.model,
        });
        if (custom !== undefined && custom.trim()) {
          const cfg = vscode.workspace.getConfiguration("localCopilot");
          await cfg.update("model", custom.trim(), vscode.ConfigurationTarget.Global);
          vscode.window.showInformationMessage(`Model set to: ${custom.trim()}`);
        }
      } else {
        const cfg = vscode.workspace.getConfiguration("localCopilot");
        await cfg.update("model", selected.label, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(`Model set to: ${selected.label}`);
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
    vscode.commands.registerCommand("localCopilot.showDiagnostics", async () => {
      const config = await getEffectiveConfig(secrets);
      const stats = completionProvider?.orchestratorInstance.cacheStats;
      const info = [
        `Provider: ${config.provider}`,
        `Model: ${config.model || "(not set)"}`,
        `Base URL: ${config.baseUrl}`,
        `API Key: ${SecretManager.maskApiKey(config.apiKey)}`,
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
