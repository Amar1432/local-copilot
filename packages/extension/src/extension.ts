import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext): void {
  console.log("Local Copilot is now active!");

  // Register commands
  registerCommands(context);

  // Register inline completion provider
  registerCompletionProvider(context);
}

export function deactivate(): void {
  console.log("Local Copilot is deactivated.");
}

function registerCommands(context: vscode.ExtensionContext): void {
  // Enable command
  context.subscriptions.push(
    vscode.commands.registerCommand("localCopilot.enable", () => {
      const config = vscode.workspace.getConfiguration("localCopilot");
      config.update("enabled", true, vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage("Local Copilot enabled");
    })
  );

  // Disable command
  context.subscriptions.push(
    vscode.commands.registerCommand("localCopilot.disable", () => {
      const config = vscode.workspace.getConfiguration("localCopilot");
      config.update("enabled", false, vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage("Local Copilot disabled");
    })
  );

  // Trigger completion command
  context.subscriptions.push(
    vscode.commands.registerCommand("localCopilot.triggerCompletion", () => {
      vscode.commands.executeCommand("editor.action.triggerSuggest");
    })
  );

  // Select model command
  context.subscriptions.push(
    vscode.commands.registerCommand("localCopilot.selectModel", async () => {
      // TODO: Implement model selection quick pick
      vscode.window.showInformationMessage("Model selection coming soon");
    })
  );

  // Select provider command
  context.subscriptions.push(
    vscode.commands.registerCommand("localCopilot.selectProvider", async () => {
      // TODO: Implement provider selection quick pick
      vscode.window.showInformationMessage("Provider selection coming soon");
    })
  );

  // Test connection command
  context.subscriptions.push(
    vscode.commands.registerCommand("localCopilot.testConnection", async () => {
      // TODO: Implement connection test
      vscode.window.showInformationMessage("Connection test coming soon");
    })
  );

  // Show diagnostics command
  context.subscriptions.push(
    vscode.commands.registerCommand("localCopilot.showDiagnostics", () => {
      // TODO: Implement diagnostics view
      vscode.window.showInformationMessage("Diagnostics view coming soon");
    })
  );

  // Clear cache command
  context.subscriptions.push(
    vscode.commands.registerCommand("localCopilot.clearCache", () => {
      // TODO: Implement cache clearing
      vscode.window.showInformationMessage("Cache cleared");
    })
  );

  // Open settings command
  context.subscriptions.push(
    vscode.commands.registerCommand("localCopilot.openSettings", () => {
      vscode.commands.executeCommand("workbench.action.openSettings", "localCopilot");
    })
  );
}

function registerCompletionProvider(context: vscode.ExtensionContext): void {
  const selector: vscode.DocumentSelector = [
    { language: "typescript" },
    { language: "javascript" },
    { language: "typescriptreact" },
    { language: "javascriptreact" },
  ];

  const provider = new LocalCopilotCompletionProvider();

  context.subscriptions.push(
    vscode.languages.registerInlineCompletionItemProvider(selector, provider)
  );
}

class LocalCopilotCompletionProvider implements vscode.InlineCompletionItemProvider {
  provideInlineCompletionItems(
    _document: vscode.TextDocument,
    _position: vscode.Position,
    _context: vscode.InlineCompletionContext,
    _token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.InlineCompletionList> {
    // TODO: Implement completion logic
    // This will be implemented in Sprint 2
    return { items: [] };
  }
}
