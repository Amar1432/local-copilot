/**
 * Utilities for context token estimation, budgeting, and chunk ranking.
 */

import type { ContextBudget, ContextChunk } from "./context.types";

// ---------------------------------------------------------------------------
// Budget presets
// ---------------------------------------------------------------------------

/**
 * Named budget configurations for different completion latency tiers.
 * Each preset defines total token budget, reservation for prompt/prefix/suffix,
 * and chunk-level limits.
 */
export interface ContextBudgetPreset {
  readonly name: string;
  readonly maxTokens: number;
  readonly reservedTokens: number;
  readonly maxChunks: number;
  readonly maxLines: number;
  readonly maxLinesPerChunk: number;
  readonly maxTokensPerChunk: number;
}

/** Fast path — small context, minimal latency budget. */
export const FAST_BUDGET: ContextBudgetPreset = {
  name: "fast",
  maxTokens: 512,
  reservedTokens: 256,
  maxChunks: 4,
  maxLines: 60,
  maxLinesPerChunk: 20,
  maxTokensPerChunk: 128,
};

/** Balanced — default context budget for typical completions. */
export const BALANCED_BUDGET: ContextBudgetPreset = {
  name: "balanced",
  maxTokens: 1024,
  reservedTokens: 512,
  maxChunks: 10,
  maxLines: 200,
  maxLinesPerChunk: 50,
  maxTokensPerChunk: 300,
};

/** Rich path — larger context for slower completions. */
export const RICH_BUDGET: ContextBudgetPreset = {
  name: "rich",
  maxTokens: 2048,
  reservedTokens: 512,
  maxChunks: 16,
  maxLines: 400,
  maxLinesPerChunk: 60,
  maxTokensPerChunk: 400,
};

/** Lookup table for preset name to configuration. */
export const BUDGET_PRESETS: ReadonlyMap<string, ContextBudgetPreset> = new Map([
  [FAST_BUDGET.name, FAST_BUDGET],
  [BALANCED_BUDGET.name, BALANCED_BUDGET],
  [RICH_BUDGET.name, RICH_BUDGET],
]);

// ---------------------------------------------------------------------------
// Default budget (legacy — prefer presets)
// ---------------------------------------------------------------------------

/** Default context budget constraints (equivalent to BALANCED). */
export const DEFAULT_CONTEXT_BUDGET: ContextBudget = {
  maxTokens: BALANCED_BUDGET.maxTokens,
  maxChunks: BALANCED_BUDGET.maxChunks,
  maxLines: BALANCED_BUDGET.maxLines,
  maxLinesPerChunk: BALANCED_BUDGET.maxLinesPerChunk,
  maxTokensPerChunk: BALANCED_BUDGET.maxTokensPerChunk,
  reservedTokens: BALANCED_BUDGET.reservedTokens,
};

// ---------------------------------------------------------------------------
// Token estimation
// ---------------------------------------------------------------------------

/** Fast character-heuristic token estimator (~4 chars per token for code). */
export function estimateTokenCount(text: string): number {
  if (!text) {
    return 0;
  }
  return Math.ceil(text.length / 4);
}

/** Truncate text to fit within a given token budget. */
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

// ---------------------------------------------------------------------------
// Effective budget computation
// ---------------------------------------------------------------------------

/** Parameters for computing an effective context budget given a prompt layout. */
export interface EffectiveBudgetParams {
  readonly totalTokens: number;
  readonly promptTemplateTokens: number;
  readonly prefixTokens: number;
  readonly suffixTokens: number;
  readonly maxChunks?: number;
  readonly maxLines?: number;
  readonly maxLinesPerChunk?: number;
  readonly maxTokensPerChunk?: number;
}

/**
 * Compute a ContextBudget from the total token budget and the prompt layout.
 * reservedTokens is set to the sum of template + prefix + suffix, and
 * maxTokens is set to the total budget. The effective context capacity is
 * (maxTokens - reservedTokens).
 */
export function computeEffectiveBudget(params: EffectiveBudgetParams): ContextBudget {
  const reservedTokens =
    params.promptTemplateTokens + params.prefixTokens + params.suffixTokens;
  return {
    maxTokens: Math.max(0, params.totalTokens),
    maxChunks: params.maxChunks ?? BALANCED_BUDGET.maxChunks,
    maxLines: params.maxLines ?? BALANCED_BUDGET.maxLines,
    maxLinesPerChunk: params.maxLinesPerChunk ?? BALANCED_BUDGET.maxLinesPerChunk,
    maxTokensPerChunk: params.maxTokensPerChunk ?? BALANCED_BUDGET.maxTokensPerChunk,
    reservedTokens,
  };
}

/**
 * Compute the effective context capacity available for context chunks.
 * This is maxTokens minus reservedTokens.
 */
export function effectiveCapacity(budget: ContextBudget): number {
  return Math.max(0, budget.maxTokens - (budget.reservedTokens ?? 0));
}

// ---------------------------------------------------------------------------
// Chunk ranking and budget filtering
// ---------------------------------------------------------------------------

/**
 * Rank context chunks by priority score (descending) and filter them
 * according to the provided budget constraints.
 *
 * reservedTokens is treated as excluded capacity: only
 * (maxTokens - reservedTokens) tokens are available for actual context chunks.
 */
export function rankAndFilterChunks(
  chunks: readonly ContextChunk[],
  budget: ContextBudget
): ContextChunk[] {
  if (!chunks || chunks.length === 0) {
    return [];
  }

  const capacity = effectiveCapacity(budget);

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

    // Check if adding this chunk exceeds the effective capacity
    if (totalTokens + tokens > capacity) {
      const remainingTokens = capacity - totalTokens;
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

// ---------------------------------------------------------------------------
// Multi-provider assembly
// ---------------------------------------------------------------------------

/**
 * Flatten, deduplicate by chunk id, and apply budget constraints to chunks
 * collected from multiple context providers.
 */
export function assembleChunksFromProviders(
  providerChunks: ReadonlyArray<readonly ContextChunk[]>,
  budget: ContextBudget
): ContextChunk[] {
  const seen = new Set<string>();
  const flat: ContextChunk[] = [];

  for (const chunks of providerChunks) {
    for (const chunk of chunks) {
      if (seen.has(chunk.id)) continue;
      seen.add(chunk.id);
      flat.push(chunk);
    }
  }

  return rankAndFilterChunks(flat, budget);
}
