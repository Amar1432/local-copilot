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
  private readonly onLatencyUpdate?: (latencyMs: number | null) => void;

  constructor(
    config: ProviderConfig,
    contextProviders: ContextProvider[] = [],
    onLatencyUpdate?: (latencyMs: number | null) => void
  ) {
    this.orchestrator = new CompletionOrchestrator(config, undefined, contextProviders);
    this.onLatencyUpdate = onLatencyUpdate;
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
   * Get the metrics tracker instance.
   */
  get metrics() {
    return this.orchestrator.metrics;
  }

  /**
   * Record that a completion was accepted by the user.
   */
  recordAcceptance(options: {
    readonly id?: string;
    readonly text?: string;
    readonly language?: string;
    readonly latencyMs?: number;
    readonly charCount?: number;
    readonly lineCount?: number;
  }): void {
    this.orchestrator.metrics.recordAcceptance(options);
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

    if (this.orchestrator.latencyMs !== null && this.onLatencyUpdate) {
      this.onLatencyUpdate(this.orchestrator.latencyMs);
    }

    if (!result || token.isCancellationRequested) {
      return { items: [] };
    }

    // Suppress completions that are already present at the cursor position.
    // After accepting a ghost text suggestion, the model may re-suggest the
    // same text because buildCompletionRequest excludes the current line from
    // both prefix and suffix — the model has no visibility into what's already
    // on the current line. This check prevents the repeating-ghost-text loop.
    if (isCompletionAlreadyPresent(document, position, result)) {
      return { items: [] };
    }

    const latencyMs = Date.now() - startTime;
    console.log(`[Local Copilot] Completion in ${latencyMs}ms: "${result.slice(0, 50)}..."`);

    return {
      items: [
        {
          insertText: result,
          range: new vscode.Range(position, position),
          command: {
            title: "Local Copilot Completion Accepted",
            command: "localCopilot.completionAccepted",
            arguments: [
              {
                text: result,
                language: document.languageId,
                latencyMs,
                charCount: result.length,
                lineCount: result.split("\n").length,
              },
            ],
          },
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
 * Check if the suggested completion is already present at the cursor position
 * or exists elsewhere in the document after the cursor.
 *
 * Prevents two common duplicate-suggestion scenarios:
 * 1. Repeating ghost text: the model re-suggests text just accepted on the
 *    current line (cursor line is excluded from prefix/suffix context).
 * 2. Reusing existing blocks: the model suggests code blocks that already
 *    exist further down in the file because the suffix context is limited.
 */
function isCompletionAlreadyPresent(
  document: vscode.TextDocument,
  position: vscode.Position,
  completion: string
): boolean {
  const trimmedCompletion = completion.trim();
  if (!trimmedCompletion) return false;

  // --- Check 1: same-line duplicate (just-accepted or already-ahead) ---
  const currentLineText = document.lineAt(position.line).text;
  const textBeforeCursor = currentLineText.substring(0, position.character);
  const textAfterCursorOnLine = currentLineText.substring(position.character);

  // Model re-suggesting text cursor just moved past
  if (textBeforeCursor.endsWith(trimmedCompletion)) {
    return true;
  }
  // Inserting would overlap with existing text on this line
  if (textAfterCursorOnLine.startsWith(trimmedCompletion)) {
    return true;
  }

  // Preceding lines check: block or statement already written directly before cursor
  const startLine = Math.max(0, position.line - 10);
  const textBeforeCursorMultiLine = document
    .getText(
      new vscode.Range(
        new vscode.Position(startLine, 0),
        position
      )
    )
    .trimEnd();
  if (textBeforeCursorMultiLine.endsWith(trimmedCompletion)) {
    return true;
  }

  // --- Check 2: multi-line suggestion already in document after cursor ---
  // For non-trivial suggestions (multi-line or >20 chars), check whether the
  // document text from the cursor forward already contains the same block.
  // This catches the case where the model reuses a function/block that exists
  // later in the file while the cursor is on an empty or short line above it.
  if (trimmedCompletion.includes("\n") || trimmedCompletion.length > 20) {
    const firstLine = trimmedCompletion.split("\n")[0].trim();
    if (!firstLine) return false;

    // Collect document text from the cursor position to the end
    const endLine = Math.min(
      position.line + 20,
      document.lineCount - 1
    );
    const textAfterCursor = document
      .getText(
        new vscode.Range(
          position,
          new vscode.Position(endLine, document.lineAt(endLine).text.length)
        )
      )
      .trimStart();

    if (textAfterCursor.startsWith(firstLine)) {
      return true;
    }
  }

  return false;
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
