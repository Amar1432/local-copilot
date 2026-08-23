import * as vscode from "vscode";
import type { ProviderConfig } from "@local-copilot/shared";
import type { ContextProvider } from "@local-copilot/core";
import {
  FileContextExtractor,
  RecentFilesBuffer,
  RecentFilesProvider,
  ImportDefinitionResolver,
  type ImportFileAccess,
} from "@local-copilot/core";
import { getConfiguration, onConfigurationChanged } from "./configuration";
import { StatusBarManager, showStatusBarQuickMenu } from "./status-bar";
import { LocalCopilotCompletionProvider } from "./completion-provider";
import { SecretManager } from "./secret-manager";
import { ModelDiscoveryService } from "@local-copilot/core";
import { DiagnosticsPanel, type DiagnosticsSnapshot } from "./diagnostics-panel";

let statusBar: StatusBarManager | undefined;
let completionProvider: LocalCopilotCompletionProvider | undefined;
let secretManager: SecretManager | undefined;
let recentFilesBuffer: RecentFilesBuffer | undefined;
let diagnosticsPanel: DiagnosticsPanel | undefined;

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
  statusBar = new StatusBarManager({
    status: "disconnected",
    localOnly: config.localOnly,
    model: config.model,
    provider: config.provider,
    enabled: config.enabled,
  });
  context.subscriptions.push(statusBar);

  // Initialize context providers for multi-file context gathering
  const contextProviders = createContextProviders();

  // Completion provider (passes latency updates to the status bar)
  completionProvider = new LocalCopilotCompletionProvider(
    config,
    contextProviders,
    (latencyMs) => statusBar?.setLatency(latencyMs)
  );
  registerCompletionProvider(context, completionProvider);

  // Commands
  registerCommands(context, statusBar, secretManager);

  // Real-time diagnostics webview panel (replaces the old modal dialog)
  diagnosticsPanel = new DiagnosticsPanel(() =>
    buildDiagnosticsSnapshot(context.extension?.packageJSON?.version ?? "unknown")
  );
  context.subscriptions.push(diagnosticsPanel);

  // Track recently opened documents for context gathering
  recentFilesBuffer = new RecentFilesBuffer();
  trackRecentDocuments(context, recentFilesBuffer);

  // Listen for configuration changes
  context.subscriptions.push(
    onConfigurationChanged(async (newConfig) => {
      const effective = await getEffectiveConfig(secretManager);
      completionProvider?.updateConfig(effective);
      statusBar?.update({
        status: "disconnected",
        localOnly: newConfig.localOnly,
        model: newConfig.model,
        provider: newConfig.provider,
        enabled: newConfig.enabled,
      });
      await diagnosticsPanel?.update();
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
  diagnosticsPanel?.dispose();
  statusBar = undefined;
  completionProvider = undefined;
  secretManager = undefined;
  diagnosticsPanel = undefined;
  console.log("Local Copilot deactivated.");
}

/**
 * Collect the current diagnostics snapshot from configuration,
 * orchestrator state, and cache statistics.
 */
async function buildDiagnosticsSnapshot(extensionVersion: string): Promise<DiagnosticsSnapshot> {
  const config = await getEffectiveConfig(secretManager);
  const orchestrator = completionProvider?.orchestratorInstance;
  return {
    extensionVersion,
    config,
    apiKeyMasked: SecretManager.maskApiKey(config.apiKey),
    connectionState: orchestrator?.connectionState ?? "idle",
    latencyMs: orchestrator?.latencyMs ?? null,
    cacheStats: orchestrator?.cacheStats ?? null,
    metrics: orchestrator?.metrics.getSummary() ?? null,
  };
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
      const cfg = getConfiguration();
      status.setStatus("checking", cfg.localOnly, cfg.model);
      vscode.window.showInformationMessage("Testing connection...");
      try {
        const connected = await completionProvider?.orchestratorInstance.testProviderConnection();
        const latency = completionProvider?.orchestratorInstance.latencyMs;
        if (connected) {
          status.setStatus("connected", cfg.localOnly, cfg.model, latency);
          vscode.window.showInformationMessage("Connection successful!");
        } else {
          status.setStatus("disconnected", cfg.localOnly, cfg.model);
          vscode.window.showErrorMessage("Connection failed. Check your provider settings.");
        }
      } catch {
        status.setStatus("disconnected", cfg.localOnly, cfg.model);
        vscode.window.showErrorMessage("Connection test failed.");
      } finally {
        await diagnosticsPanel?.update();
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("localCopilot.statusBarMenu", async () => {
      await showStatusBarQuickMenu();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("localCopilot.showDiagnostics", async () => {
      await diagnosticsPanel?.show();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("localCopilot.viewMetrics", async () => {
      await diagnosticsPanel?.show();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "localCopilot.completionAccepted",
      (options?: {
        readonly id?: string;
        readonly text?: string;
        readonly language?: string;
        readonly latencyMs?: number;
        readonly charCount?: number;
        readonly lineCount?: number;
      }) => {
        if (options) {
          completionProvider?.recordAcceptance(options);
        }
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("localCopilot.resetMetrics", () => {
      completionProvider?.orchestratorInstance.metrics.reset();
      vscode.window.showInformationMessage("Completion metrics reset");
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

  context.subscriptions.push(
    vscode.commands.registerCommand("localCopilot.toggle", async () => {
      const cfg = vscode.workspace.getConfiguration("localCopilot");
      const current = cfg.get<boolean>("enabled", true);
      const next = !current;
      await cfg.update("enabled", next, vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage(`Local Copilot ${next ? "enabled" : "disabled"}`);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("localCopilot.quickSettings", async () => {
      await showQuickSettingsMenu();
    })
  );
}

// ---------------------------------------------------------------------------
// Quick Settings menu (localCopilot.quickSettings)
// ---------------------------------------------------------------------------

type QuickSettingKey =
  | "enabled"
  | "provider"
  | "model"
  | "localOnly"
  | "debounceMs"
  | "requestTimeoutMs"
  | "temperature"
  | "maxOutputTokens"
  | "contextBudgetPreset";

type QuickSettingKind = "boolean" | "enum" | "number" | "string";

interface QuickSettingDef {
  readonly key: QuickSettingKey;
  readonly label: string;
  readonly kind: QuickSettingKind;
  readonly options?: readonly string[];
  readonly prompt?: string;
}

const QUICK_SETTINGS: readonly QuickSettingDef[] = [
  { key: "enabled", label: "Enabled", kind: "boolean" },
  {
    key: "provider",
    label: "Provider",
    kind: "enum",
    options: ["custom", "ollama", "openai", "lmstudio", "vllm"],
  },
  { key: "model", label: "Model", kind: "string", prompt: "Enter model identifier" },
  { key: "localOnly", label: "Local Only", kind: "boolean" },
  {
    key: "debounceMs",
    label: "Debounce (ms)",
    kind: "number",
    prompt: "Debounce delay in milliseconds (0-1000)",
  },
  {
    key: "requestTimeoutMs",
    label: "Request Timeout (ms)",
    kind: "number",
    prompt: "Request timeout in milliseconds (500-10000)",
  },
  {
    key: "temperature",
    label: "Temperature",
    kind: "number",
    prompt: "Sampling temperature (0-1)",
  },
  {
    key: "maxOutputTokens",
    label: "Max Output Tokens",
    kind: "number",
    prompt: "Maximum output tokens (1-1024)",
  },
  {
    key: "contextBudgetPreset",
    label: "Context Budget Preset",
    kind: "enum",
    options: ["fast", "balanced", "rich"],
  },
];

function formatSettingValue(value: unknown): string {
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value === undefined || value === null || value === "") return "(unset)";
  return String(value);
}

/**
 * Prompt the user for a new value for a single quick setting and return it.
 * Returns `undefined` if the user cancelled the value prompt (so the menu
 * stays open for another choice).
 */
async function promptForSettingValue(
  def: QuickSettingDef,
  config: vscode.WorkspaceConfiguration
): Promise<unknown> {
  if (def.kind === "boolean") {
    const current = config.get<boolean>(def.key, false);
    const picked = await vscode.window.showQuickPick(
      [
        { label: "true", value: true },
        { label: "false", value: false },
      ] as unknown as vscode.QuickPickItem[],
      { placeHolder: `${def.label} (currently ${current})` }
    );
    return picked ? (picked as unknown as { value: boolean }).value : undefined;
  }

  if (def.kind === "enum" && def.options) {
    const current = config.get<string>(def.key, "");
    const picked = await vscode.window.showQuickPick(
      def.options.map((o) => ({ label: o })),
      { placeHolder: `${def.label} (currently ${current})` }
    );
    return picked ? (picked as { label: string }).label : undefined;
  }

  if (def.kind === "number") {
    const current = config.get<number>(def.key, 0);
    const input = await vscode.window.showInputBox({
      prompt: def.prompt ?? def.label,
      value: String(current),
      validateInput: (raw) =>
        /^\d+(\.\d+)?$/.test(raw.trim()) ? null : "Please enter a number",
    });
    if (input === undefined) return undefined;
    const parsed = Number(input.trim());
    return Number.isNaN(parsed) ? undefined : parsed;
  }

  const current = config.get<string>(def.key, "");
  const input = await vscode.window.showInputBox({
    prompt: def.prompt ?? def.label,
    value: current,
  });
  return input === undefined ? undefined : input.trim();
}

/**
 * Interactive QuickPick loop letting the user adjust common settings. Re-opens
 * after each change until the user cancels (Esc) at the top-level menu.
 */
async function showQuickSettingsMenu(): Promise<void> {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const config = vscode.workspace.getConfiguration("localCopilot");
    const items = QUICK_SETTINGS.map((s) => ({
      setting: s.key,
      label: `$(gear) ${s.label}`,
      description: `Currently: ${formatSettingValue(config.get(s.key))}`,
    })) as unknown as vscode.QuickPickItem[];

    const picked = await vscode.window.showQuickPick(items, {
      placeHolder: "Quick Settings — select a setting to change (Esc to finish)",
    });
    if (!picked) return;

    const def = QUICK_SETTINGS.find(
      (s) => s.key === (picked as unknown as { setting: QuickSettingKey }).setting
    );
    if (!def) return;

    const updated = await promptForSettingValue(def, config);
    if (updated === undefined) continue;

    await config.update(def.key, updated, vscode.ConfigurationTarget.Global);
    vscode.window.showInformationMessage(
      `${def.label} set to ${formatSettingValue(updated)}`
    );
  }
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
    { language: "python" },
    { language: "go" },
    { language: "rust" },
    { language: "java" },
    { language: "c" },
    { language: "cpp" },
  ];

  context.subscriptions.push(
    vscode.languages.registerInlineCompletionItemProvider(selector, provider)
  );
}

// ---------------------------------------------------------------------------
// Context Providers
// ---------------------------------------------------------------------------

/**
 * Create the set of context providers for multi-file context gathering.
 */
function createContextProviders(): ContextProvider[] {
  const providers: ContextProvider[] = [];

  // 1. Active file context extractor (imports, enclosing scope, declarations)
  providers.push(new FileContextExtractor());

  // 2. Recent files provider (top-level symbols from recently opened documents)
  if (recentFilesBuffer) {
    providers.push(new RecentFilesProvider(recentFilesBuffer));
  }

  // 3. Import/definition resolver (resolve relative imports to workspace files)
  const fileAccess: ImportFileAccess = {
    async findExisting(uris: readonly string[]): Promise<readonly string[]> {
      const existing: string[] = [];
      for (const uri of uris) {
        try {
          const parsed = vscode.Uri.parse(uri);
          try {
            await vscode.workspace.fs.stat(parsed);
            existing.push(uri);
          } catch {
            // File doesn't exist
          }
        } catch {
          // Invalid URI
        }
      }
      return existing;
    },
    async readText(uri: string): Promise<string | null> {
      try {
        const parsed = vscode.Uri.parse(uri);
        const bytes = await vscode.workspace.fs.readFile(parsed);
        return new TextDecoder().decode(bytes);
      } catch {
        return null;
      }
    },
  };
  providers.push(new ImportDefinitionResolver(fileAccess));

  return providers;
}

/**
 * Set up listeners to track recently opened/changed documents.
 */
function trackRecentDocuments(
  context: vscode.ExtensionContext,
  buffer: RecentFilesBuffer
): void {
  // Track when documents are opened
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((document) => {
      if (isTrackedLanguage(document.languageId) && !document.isUntitled) {
        buffer.record({
          uri: document.uri.toString(),
          language: document.languageId,
          text: document.getText(),
        });
      }
    })
  );

  // Track when documents are changed
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      const document = event.document;
      if (isTrackedLanguage(document.languageId) && !document.isUntitled) {
        buffer.record({
          uri: document.uri.toString(),
          language: document.languageId,
          text: document.getText(),
        });
      }
    })
  );

  // Track when documents are closed
  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument((document) => {
      buffer.remove(document.uri.toString());
    })
  );

  // Record any already-open documents
  for (const document of vscode.workspace.textDocuments) {
    if (isTrackedLanguage(document.languageId) && !document.isUntitled) {
      buffer.record({
        uri: document.uri.toString(),
        language: document.languageId,
        text: document.getText(),
      });
    }
  }
}

/**
 * Check if a language ID should be tracked for recent files context.
 */
function isTrackedLanguage(languageId: string): boolean {
  const tracked = [
    "typescript",
    "javascript",
    "typescriptreact",
    "javascriptreact",
    "python",
    "go",
    "rust",
    "java",
    "c",
    "cpp",
  ];
  return tracked.includes(languageId);
}
