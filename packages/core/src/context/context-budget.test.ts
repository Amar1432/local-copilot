import { describe, expect, it } from "vitest";
import {
  DEFAULT_CONTEXT_BUDGET,
  estimateTokenCount,
  rankAndFilterChunks,
  truncateToTokenBudget,
} from "./context-budget";
import { ContextPriority, type ContextBudget, type ContextChunk } from "./context.types";

describe("Context Budget & Ranking", () => {
  it("should have sensible default budget", () => {
    expect(DEFAULT_CONTEXT_BUDGET.maxTokens).toBeGreaterThan(0);
    expect(DEFAULT_CONTEXT_BUDGET.maxChunks).toBeGreaterThan(0);
  });

  it("should estimate token count using character heuristic", () => {
    expect(estimateTokenCount("")).toBe(0);
    expect(estimateTokenCount("abcd")).toBe(1);
    expect(estimateTokenCount("12345678")).toBe(2);
    expect(estimateTokenCount("123456789")).toBe(3);
  });

  it("should truncate text to token budget", () => {
    const text = "1234567890123456"; // 16 chars = ~4 tokens
    expect(truncateToTokenBudget(text, 2)).toBe("12345678");
    expect(truncateToTokenBudget(text, 10)).toBe(text);
    expect(truncateToTokenBudget(text, 0)).toBe("");
  });

  it("should sort and rank chunks by score descending", () => {
    const chunks: ContextChunk[] = [
      { id: "chunk-low", type: "recent", uri: "file3.ts", content: "low", score: ContextPriority.LOW },
      { id: "chunk-crit", type: "definition", uri: "file1.ts", content: "crit", score: ContextPriority.CRITICAL },
      { id: "chunk-med", type: "import", uri: "file2.ts", content: "med", score: ContextPriority.MEDIUM },
    ];

    const budget: ContextBudget = { maxTokens: 1000, maxChunks: 10 };
    const ranked = rankAndFilterChunks(chunks, budget);

    expect(ranked.map((c) => c.id)).toEqual(["chunk-crit", "chunk-med", "chunk-low"]);
  });

  it("should respect maxChunks limit", () => {
    const chunks: ContextChunk[] = [
      { id: "chunk-1", type: "file", uri: "f1.ts", content: "c1", score: 90 },
      { id: "chunk-2", type: "file", uri: "f2.ts", content: "c2", score: 80 },
      { id: "chunk-3", type: "file", uri: "f3.ts", content: "c3", score: 70 },
    ];

    const budget: ContextBudget = { maxTokens: 1000, maxChunks: 2 };
    const ranked = rankAndFilterChunks(chunks, budget);

    expect(ranked).toHaveLength(2);
    expect(ranked.map((c) => c.id)).toEqual(["chunk-1", "chunk-2"]);
  });

  it("should respect maxTokens budget limit", () => {
    const chunks: ContextChunk[] = [
      { id: "chunk-1", type: "file", uri: "f1.ts", content: "a".repeat(40), score: 90, estimatedTokens: 10 },
      { id: "chunk-2", type: "file", uri: "f2.ts", content: "b".repeat(40), score: 80, estimatedTokens: 10 },
      { id: "chunk-3", type: "file", uri: "f3.ts", content: "c".repeat(40), score: 70, estimatedTokens: 10 },
    ];

    const budget: ContextBudget = { maxTokens: 15 };
    const ranked = rankAndFilterChunks(chunks, budget);

    expect(ranked.length).toBeGreaterThanOrEqual(1);
    const totalEstimatedTokens = ranked.reduce((acc, c) => acc + (c.estimatedTokens ?? 0), 0);
    expect(totalEstimatedTokens).toBeLessThanOrEqual(15);
  });

  it("should handle empty or null chunk lists gracefully", () => {
    expect(rankAndFilterChunks([], { maxTokens: 100 })).toEqual([]);
  });
});
