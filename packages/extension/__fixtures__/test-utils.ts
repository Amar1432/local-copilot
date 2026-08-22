import type { ProviderConfig } from "@local-copilot/shared";
import { Position, Range } from "../__mocks__/vscode";
import type { CompletionScenario } from "./completion-scenarios";

// ---------------------------------------------------------------------------
// Mock TextDocument
// ---------------------------------------------------------------------------

export interface MockTextDocument {
  readonly uri: string;
  readonly languageId: string;
  readonly lineCount: number;
  readonly version: number;
  getText(range?: Range): string;
  lineAt(line: number): { readonly text: string; readonly lineNumber: number };
}

/**
 * Create a mock TextDocument from a string.
 * Use `|` to mark the cursor position — it is stripped from the output.
 */
export function createMockDocument(
  text: string,
  languageId = "typescript",
  uri = "file:///test.ts"
): MockTextDocument & { readonly cursorOffset: number } {
  const cursorOffset = text.indexOf("|");
  const cleanText = text.replace("|", "");
  const lines = cleanText.split("\n");

  return {
    uri,
    languageId,
    lineCount: lines.length,
    version: 1,

    getText(range?: Range): string {
      if (!range) return cleanText;

      const startOffset = offsetFromPosition(cleanText, range.start);
      const endOffset = offsetFromPosition(cleanText, range.end);
      return cleanText.slice(startOffset, endOffset);
    },

    lineAt(line: number) {
      return {
        text: lines[line] ?? "",
        lineNumber: line,
      };
    },

    cursorOffset,
  };
}

/**
 * Create a mock document from a CompletionScenario fixture.
 */
export function createMockDocumentFromScenario(
  scenario: CompletionScenario
): MockTextDocument & { readonly cursorOffset: number } {
  return createMockDocument(
    scenario.document,
    scenario.language,
    `file:///${scenario.name.replace(/\s+/g, "-").toLowerCase()}.ts`
  );
}

// ---------------------------------------------------------------------------
// Mock Position & Range helpers
// ---------------------------------------------------------------------------

export function createPosition(line: number, character: number): Position {
  return new Position(line, character);
}

export function createRange(
  startLine: number,
  startChar: number,
  endLine: number,
  endChar: number
): Range {
  return new Range(new Position(startLine, startChar), new Position(endLine, endChar));
}

// ---------------------------------------------------------------------------
// Mock CancellationToken
// ---------------------------------------------------------------------------

export interface MockCancellationToken {
  isCancellationRequested: boolean;
  onCancellationRequested: (listener: () => void) => { dispose(): void };
}

export function createMockCancellationToken(cancelled = false): MockCancellationToken {
  return {
    isCancellationRequested: cancelled,
    onCancellationRequested: () => ({ dispose: () => {} }),
  };
}

// ---------------------------------------------------------------------------
// Mock InlineCompletionContext
// ---------------------------------------------------------------------------

export interface MockInlineCompletionContext {
  readonly triggerKind: number;
  readonly selectedCompletionInfo: unknown;
}

export function createMockCompletionContext(triggerKind = 0): MockInlineCompletionContext {
  return {
    triggerKind,
    selectedCompletionInfo: undefined,
  };
}

// ---------------------------------------------------------------------------
// Default ProviderConfig factory
// ---------------------------------------------------------------------------

export function createDefaultConfig(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
  return {
    enabled: true,
    provider: "custom",
    baseUrl: "http://localhost:11434/v1",
    apiKey: "",
    model: "qwen-coder",
    debounceMs: 150,
    requestTimeoutMs: 2000,
    maxOutputTokens: 128,
    temperature: 0.1,
    contextMaxLines: 120,
    localOnly: true,
    telemetryEnabled: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function offsetFromPosition(text: string, pos: Position): number {
  const lines = text.split("\n");
  let offset = 0;
  for (let i = 0; i < pos.line && i < lines.length; i++) {
    offset += lines[i].length + 1; // +1 for \n
  }
  offset += Math.min(pos.character, lines[pos.line]?.length ?? 0);
  return offset;
}
