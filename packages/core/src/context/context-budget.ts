/**
 * Utilities for context token estimation, budgeting, and chunk ranking.
 */

import type { ContextBudget, ContextChunk } from "./context.types";

/**
 * Default context budget constraints
 */
export const DEFAULT_CONTEXT_BUDGET: ContextBudget = {
  maxTokens: 1024,
  maxChunks: 10,
  maxLines: 200,
  maxLinesPerChunk: 50,
  maxTokensPerChunk: 300,
  reservedTokens: 512,
};

/**
 * Fast character-heuristic token estimator (~4 chars per token for code).
 */
export function estimateTokenCount(text: string): number {
  if (!text) {
    return 0;
  }
  return Math.ceil(text.length / 4);
}

/**
 * Truncate text to fit within a given token budget.
 */
export function truncateToTokenBudget(text: string, maxTokens: number): string {
  if (!text || maxTokens <= 0) {
    return "";
  }
  const estimated = estimateTokenCount(text);
  if (estimated <= maxTokens) {
    return text;
  }
  const maxChars = maxTokens * 4;
  return text.slice(0, maxChars);
}

/**
 * Rank context chunks by priority score (descending) and filter them
 * according to the provided budget constraints.
 */
export function rankAndFilterChunks(
  chunks: readonly ContextChunk[],
  budget: ContextBudget
): ContextChunk[] {
  if (!chunks || chunks.length === 0) {
    return [];
  }

  // Sort by score descending, then by id for determinism
  const sorted = [...chunks].sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.id.localeCompare(b.id);
  });

  const selected: ContextChunk[] = [];
  let totalTokens = 0;
  let totalLines = 0;

  for (const chunk of sorted) {
    // Check max chunks
    if (budget.maxChunks !== undefined && selected.length >= budget.maxChunks) {
      break;
    }

    // Process chunk lines
    let content = chunk.content;
    const lines = content.split("\n");
    if (budget.maxLinesPerChunk !== undefined && lines.length > budget.maxLinesPerChunk) {
      content = lines.slice(0, budget.maxLinesPerChunk).join("\n");
    }

    // Process chunk tokens
    let tokens = chunk.estimatedTokens ?? estimateTokenCount(content);
    if (budget.maxTokensPerChunk !== undefined && tokens > budget.maxTokensPerChunk) {
      content = truncateToTokenBudget(content, budget.maxTokensPerChunk);
      tokens = estimateTokenCount(content);
    }

    const chunkLines = content.split("\n").length;

    // Check if adding this chunk exceeds budget constraints
    if (totalTokens + tokens > budget.maxTokens) {
      // If we haven't selected anything yet, we can try truncating
      const remainingTokens = budget.maxTokens - totalTokens;
      if (remainingTokens >= 16) {
        const truncatedContent = truncateToTokenBudget(content, remainingTokens);
        const truncatedTokens = estimateTokenCount(truncatedContent);
        if (truncatedContent.length > 0) {
          selected.push({
            ...chunk,
            content: truncatedContent,
            estimatedTokens: truncatedTokens,
          });
          totalTokens += truncatedTokens;
          totalLines += truncatedContent.split("\n").length;
        }
      }
      break;
    }

    if (budget.maxLines !== undefined && totalLines + chunkLines > budget.maxLines) {
      const remainingLines = budget.maxLines - totalLines;
      if (remainingLines > 0) {
        const truncatedLines = content.split("\n").slice(0, remainingLines).join("\n");
        const truncatedTokens = estimateTokenCount(truncatedLines);
        selected.push({
          ...chunk,
          content: truncatedLines,
          estimatedTokens: truncatedTokens,
        });
        totalTokens += truncatedTokens;
        totalLines += remainingLines;
      }
      break;
    }

    selected.push(
      content === chunk.content && chunk.estimatedTokens !== undefined
        ? chunk
        : {
            ...chunk,
            content,
            estimatedTokens: tokens,
          }
    );

    totalTokens += tokens;
    totalLines += chunkLines;
  }

  return selected;
}
