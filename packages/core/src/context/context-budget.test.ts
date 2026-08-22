import { describe, expect, it } from "vitest";
import {
  BALANCED_BUDGET,
  BUDGET_PRESETS,
  DEFAULT_CONTEXT_BUDGET,
  FAST_BUDGET,
  RICH_BUDGET,
  assembleChunksFromProviders,
  computeEffectiveBudget,
  effectiveCapacity,
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
    const text = "1234567890123456";
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

describe("Budget presets", () => {
  it("should expose fast, balanced, and rich presets with increasing capacity", () => {
    expect(FAST_BUDGET.name).toBe("fast");
    expect(BALANCED_BUDGET.name).toBe("balanced");
    expect(RICH_BUDGET.name).toBe("rich");

    expect(FAST_BUDGET.maxTokens).toBeLessThan(BALANCED_BUDGET.maxTokens);
    expect(BALANCED_BUDGET.maxTokens).toBeLessThan(RICH_BUDGET.maxTokens);
  });

  it("should be queryable by name via BUDGET_PRESETS map", () => {
    expect(BUDGET_PRESETS.size).toBe(3);
    expect(BUDGET_PRESETS.get("fast")).toBe(FAST_BUDGET);
    expect(BUDGET_PRESETS.get("balanced")).toBe(BALANCED_BUDGET);
    expect(BUDGET_PRESETS.get("rich")).toBe(RICH_BUDGET);
  });

  it("should have reservedTokens less than maxTokens for all presets", () => {
    for (const preset of BUDGET_PRESETS.values()) {
      expect(preset.reservedTokens).toBeLessThan(preset.maxTokens);
      expect(effectiveCapacity(preset)).toBeGreaterThan(0);
    }
  });
});

describe("computeEffectiveBudget", () => {
  it("should set reservedTokens to template + prefix + suffix", () => {
    const budget = computeEffectiveBudget({
      totalTokens: 1024,
      promptTemplateTokens: 100,
      prefixTokens: 200,
      suffixTokens: 50,
    });

    expect(budget.maxTokens).toBe(1024);
    expect(budget.reservedTokens).toBe(350);
    expect(effectiveCapacity(budget)).toBe(674);
  });

  it("should use BALANCED defaults for unspecified constraints", () => {
    const budget = computeEffectiveBudget({
      totalTokens: 512,
      promptTemplateTokens: 0,
      prefixTokens: 0,
      suffixTokens: 0,
    });

    expect(budget.maxChunks).toBe(BALANCED_BUDGET.maxChunks);
    expect(budget.maxLines).toBe(BALANCED_BUDGET.maxLines);
    expect(budget.maxLinesPerChunk).toBe(BALANCED_BUDGET.maxLinesPerChunk);
    expect(budget.maxTokensPerChunk).toBe(BALANCED_BUDGET.maxTokensPerChunk);
  });

  it("should allow overriding per-chunk constraints", () => {
    const budget = computeEffectiveBudget({
      totalTokens: 512,
      promptTemplateTokens: 10,
      prefixTokens: 10,
      suffixTokens: 10,
      maxChunks: 5,
      maxLinesPerChunk: 10,
      maxTokensPerChunk: 60,
    });

    expect(budget.maxChunks).toBe(5);
    expect(budget.maxLinesPerChunk).toBe(10);
    expect(budget.maxTokensPerChunk).toBe(60);
  });
});

describe("effectiveCapacity", () => {
  it("should return maxTokens when reservedTokens is undefined", () => {
    expect(effectiveCapacity({ maxTokens: 1024 })).toBe(1024);
  });

  it("should subtract reservedTokens from maxTokens", () => {
    expect(effectiveCapacity({ maxTokens: 1024, reservedTokens: 512 })).toBe(512);
  });

  it("should clamp to zero when reservedTokens exceeds maxTokens", () => {
    expect(effectiveCapacity({ maxTokens: 100, reservedTokens: 200 })).toBe(0);
  });
});

describe("rankAndFilterChunks with reservedTokens", () => {
  it("should enforce effective capacity (maxTokens - reservedTokens)", () => {
    const chunks: ContextChunk[] = [
      { id: "c1", type: "file", uri: "f.ts", content: "a".repeat(200), score: 90, estimatedTokens: 50 },
      { id: "c2", type: "file", uri: "f.ts", content: "b".repeat(200), score: 80, estimatedTokens: 50 },
    ];

    const budget: ContextBudget = { maxTokens: 100, reservedTokens: 60 };
    const ranked = rankAndFilterChunks(chunks, budget);

    expect(ranked.length).toBe(1);
    expect(ranked[0].estimatedTokens ?? 0).toBeLessThanOrEqual(40);
  });
});

describe("assembleChunksFromProviders", () => {
  const makeChunk = (id: string, score: number, tokens: number): ContextChunk => ({
    id,
    type: "file" as const,
    uri: `file:///${id}.ts`,
    content: `// ${id}`,
    score,
    estimatedTokens: tokens,
  });

  it("should flatten and deduplicate chunks by id", () => {
    const shared = makeChunk("shared", 80, 10);
    const providerA = [shared, makeChunk("a-only", 90, 10)];
    const providerB = [shared, makeChunk("b-only", 70, 10)];

    const result = assembleChunksFromProviders([providerA, providerB], {
      maxTokens: 1000,
      reservedTokens: 0,
    });

    const ids = result.map((c) => c.id);
    expect(ids).toContain("shared");
    expect(ids).toContain("a-only");
    expect(ids).toContain("b-only");
    expect(ids.filter((id) => id === "shared")).toHaveLength(1);
  });

  it("should rank across providers and respect budget", () => {
    const providerA = [makeChunk("low", 40, 10)];
    const providerB = [makeChunk("high", 90, 10), makeChunk("mid", 70, 10)];

    const result = assembleChunksFromProviders([providerA, providerB], {
      maxTokens: 100,
      reservedTokens: 0,
      maxChunks: 2,
    });

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("high");
    expect(result[1].id).toBe("mid");
  });

  it("should return empty when all providers are empty", () => {
    expect(assembleChunksFromProviders([[], []], { maxTokens: 100 })).toEqual([]);
  });

  it("should apply effective capacity from reservedTokens", () => {
    const chunks = [
      makeChunk("c1", 90, 30),
      makeChunk("c2", 80, 30),
      makeChunk("c3", 70, 30),
    ];

    const result = assembleChunksFromProviders([chunks], {
      maxTokens: 100,
      reservedTokens: 70,
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("c1");
  });
});
