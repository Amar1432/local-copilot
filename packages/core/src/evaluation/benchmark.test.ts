import { describe, it, expect } from "vitest";
import {
  computeLevenshteinDistance,
  computeNormalizedSimilarity,
  isExactMatch,
  isPrefixMatch,
  computeTokenJaccard,
  computePercentiles,
} from "./similarity";
import { BenchmarkRunner } from "./benchmark-runner";
import { DEFAULT_BENCHMARK_DATASET } from "./datasets/default-dataset";
import type { BenchmarkCase, CompletionExecutor } from "./evaluation.types";

describe("Evaluation Similarity & Metrics", () => {
  describe("computeLevenshteinDistance", () => {
    it("should return 0 for identical strings", () => {
      expect(computeLevenshteinDistance("hello", "hello")).toBe(0);
      expect(computeLevenshteinDistance("", "")).toBe(0);
    });

    it("should return length when one string is empty", () => {
      expect(computeLevenshteinDistance("abc", "")).toBe(3);
      expect(computeLevenshteinDistance("", "xyz")).toBe(3);
    });

    it("should compute correct distance for edits", () => {
      expect(computeLevenshteinDistance("kitten", "sitting")).toBe(3);
      expect(computeLevenshteinDistance("const x = 1;", "const x = 2;")).toBe(1);
    });
  });

  describe("computeNormalizedSimilarity", () => {
    it("should return 1.0 for identical strings", () => {
      expect(computeNormalizedSimilarity("const a = 10;", "const a = 10;")).toBe(1.0);
    });

    it("should return higher similarity for small variations", () => {
      const sim = computeNormalizedSimilarity("return count + 1;", "return count + 2;");
      expect(sim).toBeGreaterThan(0.9);
      expect(sim).toBeLessThan(1.0);
    });

    it("should handle empty strings cleanly", () => {
      expect(computeNormalizedSimilarity("", "")).toBe(1.0);
      expect(computeNormalizedSimilarity("abc", "")).toBe(0.0);
    });
  });

  describe("isExactMatch & isPrefixMatch", () => {
    it("should detect exact matches ignoring leading/trailing whitespace", () => {
      expect(isExactMatch("  return x;  ", "return x;")).toBe(true);
      expect(isExactMatch("return x + 1;", "return x;")).toBe(false);
      expect(isExactMatch(null, "return x;")).toBe(false);
      expect(isExactMatch("return x;", undefined)).toBe(false);
    });

    it("should detect prefix matches", () => {
      expect(isPrefixMatch("return", "return x + 1;")).toBe(true);
      expect(isPrefixMatch("return x + 1;", "return")).toBe(true);
      expect(isPrefixMatch("const foo = 1;", "let bar = 2;")).toBe(false);
      expect(isPrefixMatch(null, "let bar;")).toBe(false);
    });
  });

  describe("computeTokenJaccard", () => {
    it("should return 1.0 for identical token sets", () => {
      expect(computeTokenJaccard("const x = 10;", "const x = 10;")).toBe(1.0);
    });

    it("should compute partial Jaccard index for overlapping tokens", () => {
      const jaccard = computeTokenJaccard("const a = 1;", "const b = 1;");
      expect(jaccard).toBeGreaterThan(0.5);
      expect(jaccard).toBeLessThan(1.0);
    });
  });

  describe("computePercentiles", () => {
    it("should handle empty arrays", () => {
      const stats = computePercentiles([]);
      expect(stats.mean).toBe(0);
      expect(stats.p50).toBe(0);
      expect(stats.p95).toBe(0);
    });

    it("should compute correct percentiles for sample latencies", () => {
      const latencies = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
      const stats = computePercentiles(latencies);

      expect(stats.min).toBe(10);
      expect(stats.max).toBe(100);
      expect(stats.mean).toBe(55);
      expect(stats.p50).toBe(55);
      expect(stats.p90).toBe(91);
      expect(stats.p95).toBe(95.5);
    });
  });
});

describe("BenchmarkRunner", () => {
  const mockDataset: readonly BenchmarkCase[] = [
    {
      id: "test-ts-01",
      name: "TS Sum",
      language: "typescript",
      category: "math",
      tags: ["math", "fast"],
      fullText: "function sum(a, b) {\n  return a + b;\n}",
      cursorLine: 1,
      cursorCharacter: 2,
      expectedCompletion: "return a + b;",
    },
    {
      id: "test-py-01",
      name: "Py Sum",
      language: "python",
      category: "math",
      tags: ["math"],
      fullText: "def sum(a, b):\n    return a + b",
      cursorLine: 1,
      cursorCharacter: 4,
      expectedCompletion: "return a + b",
    },
    {
      id: "test-go-01",
      name: "Go Error",
      language: "go",
      category: "control_flow",
      tags: ["error"],
      fullText: "if err != nil {\n\treturn err\n}",
      cursorLine: 1,
      cursorCharacter: 1,
      expectedCompletion: "return err",
    },
  ];

  it("should run full benchmark suite and produce summary", async () => {
    const runner = new BenchmarkRunner();
    const mockExecutor: CompletionExecutor = async (c) => ({
      completion: c.expectedCompletion ?? "default",
      latencyMs: 50,
      tokenCount: 4,
    });

    const summary = await runner.run(mockDataset, mockExecutor, {
      metadata: { model: "qwen-coder", provider: "ollama" },
    });

    expect(summary.totalCases).toBe(3);
    expect(summary.completedCases).toBe(3);
    expect(summary.failedCases).toBe(0);
    expect(summary.accuracy.exactMatchRate).toBe(1.0);
    expect(summary.accuracy.meanSimilarity).toBe(1.0);
    expect(summary.latency.p50).toBe(50);
    expect(summary.languageBreakdown.typescript).toBeDefined();
    expect(summary.languageBreakdown.python).toBeDefined();
    expect(summary.languageBreakdown.go).toBeDefined();
    expect(summary.metadata?.model).toBe("qwen-coder");
  });

  it("should support language filtering", async () => {
    const runner = new BenchmarkRunner();
    const mockExecutor: CompletionExecutor = async () => ({
      completion: "test",
      latencyMs: 25,
    });

    const summary = await runner.run(mockDataset, mockExecutor, {
      filterLanguage: ["typescript"],
    });

    expect(summary.totalCases).toBe(1);
    expect(summary.results[0].language).toBe("typescript");
  });

  it("should support category and tag filtering", async () => {
    const runner = new BenchmarkRunner();
    const mockExecutor: CompletionExecutor = async () => ({
      completion: "test",
      latencyMs: 30,
    });

    const summaryCategory = await runner.run(mockDataset, mockExecutor, {
      filterCategory: ["control_flow"],
    });
    expect(summaryCategory.totalCases).toBe(1);
    expect(summaryCategory.results[0].category).toBe("control_flow");

    const summaryTags = await runner.run(mockDataset, mockExecutor, {
      filterTags: ["fast"],
    });
    expect(summaryTags.totalCases).toBe(1);
    expect(summaryTags.results[0].caseId).toBe("test-ts-01");
  });

  it("should handle executor errors gracefully", async () => {
    const runner = new BenchmarkRunner();
    const failingExecutor: CompletionExecutor = async (c) => {
      if (c.id === "test-py-01") {
        throw new Error("Provider timeout simulated");
      }
      return { completion: c.expectedCompletion ?? "", latencyMs: 40 };
    };

    const summary = await runner.run(mockDataset, failingExecutor);
    expect(summary.totalCases).toBe(3);
    expect(summary.completedCases).toBe(2);
    expect(summary.failedCases).toBe(1);

    const failedResult = summary.results.find((r) => r.caseId === "test-py-01");
    expect(failedResult?.error).toContain("Provider timeout simulated");
  });

  it("should perform warmup runs and iterations per case", async () => {
    let callCount = 0;
    const runner = new BenchmarkRunner();
    const countingExecutor: CompletionExecutor = async () => {
      callCount++;
      return { completion: "val", latencyMs: 20 };
    };

    await runner.run(mockDataset, countingExecutor, {
      warmupIterations: 2,
      iterationsPerCase: 2,
    });

    // 2 warmup calls + 3 cases * 2 iterations = 8 total calls
    expect(callCount).toBe(8);
  });

  it("should format markdown and json reports", async () => {
    const runner = new BenchmarkRunner();
    const mockExecutor: CompletionExecutor = async (c) => ({
      completion: c.expectedCompletion ?? "",
      latencyMs: 45,
    });

    const summary = await runner.run(mockDataset, mockExecutor, {
      metadata: { model: "qwen2.5-coder:7b" },
    });

    const md = runner.formatMarkdownReport(summary);
    expect(md).toContain("# Local Copilot — Benchmark Report");
    expect(md).toContain("## Latency Profile");
    expect(md).toContain("## Quality & Accuracy");
    expect(md).toContain("## Language Breakdown");
    expect(md).toContain("qwen2.5-coder:7b");

    const json = runner.formatJsonReport(summary);
    const parsed = JSON.parse(json);
    expect(parsed.totalCases).toBe(3);
    expect(parsed.latency.p50).toBe(45);
  });

  it("should have comprehensive cases in DEFAULT_BENCHMARK_DATASET", () => {
    expect(DEFAULT_BENCHMARK_DATASET.length).toBeGreaterThanOrEqual(10);
    const languages = new Set(DEFAULT_BENCHMARK_DATASET.map((c) => c.language));
    expect(languages.has("typescript")).toBe(true);
    expect(languages.has("javascript")).toBe(true);
    expect(languages.has("python")).toBe(true);
    expect(languages.has("go")).toBe(true);
    expect(languages.has("rust")).toBe(true);
    expect(languages.has("java")).toBe(true);
  });
});
