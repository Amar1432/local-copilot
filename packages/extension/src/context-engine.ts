/**
 * Context Engine — extracts relevant context from a VS Code document
 * around the cursor position for completion requests.
 */

import type { CompletionRequest } from "@local-copilot/shared";

let requestCounter = 0;

/**
 * Build a CompletionRequest from the current editor state.
 *
 * Extracts prefix (lines above cursor) and suffix (lines below cursor)
 * based on the configured maxLines limit.
 */
export function buildCompletionRequest(params: {
  readonly documentUri: string;
  readonly documentVersion: number;
  readonly language: string;
  readonly fullText: string;
  readonly cursorLine: number;
  readonly cursorCharacter: number;
  readonly maxLines: number;
}): CompletionRequest {
  const lines = params.fullText.split("\n");
  const currentLine = lines[params.cursorLine] ?? "";

  // Prefix: lines above cursor + current line text before cursor
  const prefixStartLine = Math.max(0, params.cursorLine - params.maxLines);
  const prefixLines = lines.slice(prefixStartLine, params.cursorLine);
  const currentLinePrefix = currentLine.substring(0, params.cursorCharacter);
  const prefix = prefixLines.length > 0
    ? [...prefixLines, currentLinePrefix].join("\n")
    : currentLinePrefix;

  // Suffix: current line text after cursor + lines below cursor
  const currentLineSuffix = currentLine.substring(params.cursorCharacter);
  const suffixEndLine = Math.min(lines.length - 1, params.cursorLine + params.maxLines);
  const suffixLines = lines.slice(params.cursorLine + 1, suffixEndLine + 1);
  const suffix = suffixLines.length > 0
    ? [currentLineSuffix, ...suffixLines].join("\n")
    : currentLineSuffix;

  return {
    documentUri: params.documentUri,
    documentVersion: params.documentVersion,
    language: params.language,
    prefix,
    suffix,
    position: {
      line: params.cursorLine,
      character: params.cursorCharacter,
    },
  };
}

/**
 * Generate a unique request ID.
 */
export function generateRequestId(): string {
  requestCounter++;
  return `req-${Date.now()}-${requestCounter}`;
}

/**
 * Compute a fingerprint for deduplication.
 * Two requests with the same fingerprint are considered identical.
 */
export function computeFingerprint(params: {
  readonly documentVersion: number;
  readonly line: number;
  readonly character: number;
  readonly prefix: string;
  readonly suffix: string;
  readonly model: string;
}): string {
  return [
    params.documentVersion,
    params.line,
    params.character,
    params.prefix.length,
    params.suffix.length,
    params.model,
  ].join(":");
}
