import * as vscode from "vscode";
import type { ProviderConfig } from "@local-copilot/shared";
import type { ContextProvider } from "@local-copilot/core";
import { CompletionOrchestrator } from "./completion-orchestrator";

/**
 * Inline completion provider for Local Copilot.
 *
 * Uses the CompletionOrchestrator to request completions from the configured
 * provider, normalizes the output, and returns InlineCompletionItems to VS Code.
 */
export class LocalCopilotCompletionProvider implements vscode.InlineCompletionItemProvider {
  private orchestrator: CompletionOrchestrator;

  constructor(config: ProviderConfig, contextProviders: ContextProvider[] = []) {
    this.orchestrator = new CompletionOrchestrator(config, undefined, contextProviders);
  }

  /**
   * Update the provider configuration (called when settings change).
   */
  updateConfig(config: ProviderConfig): void {
    this.orchestrator.updateConfig(config);
  }

  /**
   * Get the orchestrator (for testing connection, etc.).
   */
  get orchestratorInstance(): CompletionOrchestrator {
    return this.orchestrator;
  }

  /**
   * Clear the completion cache.
   */
  clearCache(): void {
    this.orchestrator.clearCache();
  }

  provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    _context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.InlineCompletionList> {
    // Skip if in a comment or string (basic heuristic)
    if (isInsideCommentOrString(document, position)) {
      return { items: [] };
    }

    // Cancel any previous in-flight request
    this.orchestrator.cancel();

    // Fire-and-forget the async completion request.
    // VS Code handles the Promise-based return from provideInlineCompletionItems.
    return this.requestCompletion(document, position, token);
  }

  private async requestCompletion(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): Promise<vscode.InlineCompletionList> {
    const startTime = Date.now();

    const text = document.getText();
    const result = await this.orchestrator.requestCompletion({
      documentUri: document.uri.toString(),
      documentVersion: document.version,
      language: document.languageId,
      fullText: text,
      cursorLine: position.line,
      cursorCharacter: position.character,
      cancellationToken: token,
    });

    if (!result || token.isCancellationRequested) {
      return { items: [] };
    }

    const latencyMs = Date.now() - startTime;
    console.log(`[Local Copilot] Completion in ${latencyMs}ms: "${result.slice(0, 50)}..."`);

    return {
      items: [
        {
          insertText: result,
          range: new vscode.Range(position, position),
        },
      ],
    };
  }

  /**
   * Dispose of the provider and its resources.
   */
  dispose(): void {
    this.orchestrator.dispose();
  }
}

/**
 * Basic heuristic to detect if the cursor is inside a comment or string.
 */
function isInsideCommentOrString(
  document: vscode.TextDocument,
  position: vscode.Position
): boolean {
  const lineText = document.lineAt(position.line).text;
  const textBeforeCursor = lineText.substring(0, position.character);

  // Check for single-line comments
  if (textBeforeCursor.includes("//") || textBeforeCursor.includes("#")) {
    return true;
  }

  // Check for unclosed single or double quotes (basic)
  const singleQuotes = (textBeforeCursor.match(/'/g) || []).length;
  const doubleQuotes = (textBeforeCursor.match(/"/g) || []).length;
  if (singleQuotes % 2 !== 0 || doubleQuotes % 2 !== 0) {
    return true;
  }

  return false;
}
