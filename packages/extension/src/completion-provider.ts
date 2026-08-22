import * as vscode from "vscode";
import type { ProviderConfig } from "@local-copilot/shared";
import { getConfiguration } from "./configuration";

/**
 * Inline completion provider for Local Copilot.
 *
 * Extracts prefix/suffix context from the document and delegates to
 * a provider for actual completions. For now, this returns empty items
 * until the provider layer is implemented in Sprint 2.
 */
export class LocalCopilotCompletionProvider implements vscode.InlineCompletionItemProvider {
  private config: ProviderConfig;

  constructor() {
    this.config = getConfiguration();
  }

  /**
   * Update the provider configuration (called when settings change).
   */
  updateConfig(config: ProviderConfig): void {
    this.config = config;
  }

  provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.InlineCompletionList> {
    // Skip if disabled
    if (!this.config.enabled) {
      return { items: [] };
    }

    // Skip if no model configured
    if (!this.config.model) {
      return { items: [] };
    }

    // Skip if request was already cancelled
    if (token.isCancellationRequested) {
      return { items: [] };
    }

    // Skip if we're in a comment or string (basic heuristic)
    if (isInsideCommentOrString(document, position)) {
      return { items: [] };
    }

    // Extract context
    const prefix = getPrefix(document, position, this.config.contextMaxLines);
    const suffix = getSuffix(document, position, this.config.contextMaxLines);

    // Placeholder: will be connected to provider in Sprint 2
    void prefix;
    void suffix;
    void context;

    return { items: [] };
  }
}

/**
 * Get the text before the cursor, limited to maxLines.
 */
function getPrefix(
  document: vscode.TextDocument,
  position: vscode.Position,
  maxLines: number
): string {
  const startLine = Math.max(0, position.line - maxLines);
  const range = new vscode.Range(new vscode.Position(startLine, 0), position);
  return document.getText(range);
}

/**
 * Get the text after the cursor, limited to maxLines.
 */
function getSuffix(
  document: vscode.TextDocument,
  position: vscode.Position,
  maxLines: number
): string {
  const endLine = Math.min(document.lineCount - 1, position.line + maxLines);
  const range = new vscode.Range(
    position,
    new vscode.Position(endLine, document.lineAt(endLine).text.length)
  );
  return document.getText(range);
}

/**
 * Basic heuristic to detect if the cursor is inside a comment or string.
 * Returns true if the line prefix contains an unclosed quote or comment marker.
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
