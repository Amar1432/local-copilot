/**
 * Benchmark Runner — Coordinates automated completion evaluation runs,
 * collects latency/accuracy metrics, and generates formatted reports.
 */

import type {
  BenchmarkCase,
  BenchmarkOptions,
  BenchmarkScenarioResult,
  BenchmarkSummary,
  CompletionExecutor,
  GroupMetrics,
} from "./evaluation.types";
import {
  computeNormalizedSimilarity,
  computePercentiles,
  isExactMatch,
  isPrefixMatch,
} from "./similarity";
import { DEFAULT_BENCHMARK_DATASET } from "./datasets/default-dataset";

export class BenchmarkRunner {
  /**
   * Run a benchmark evaluation suite against the provided executor.
   */
  async run(
    dataset: readonly BenchmarkCase[] = DEFAULT_BENCHMARK_DATASET,
    executor: CompletionExecutor,
    options?: BenchmarkOptions
  ): Promise<BenchmarkSummary> {
    const startTime = Date.now();

    // 1. Filter cases based on options
    let cases = [...dataset];
    if (options?.filterLanguage && options.filterLanguage.length > 0) {
      const allowedLangs = new Set(options.filterLanguage.map((l) => l.toLowerCase()));
      cases = cases.filter((c) => allowedLangs.has(c.language.toLowerCase()));
    }
    if (options?.filterCategory && options.filterCategory.length > 0) {
      const allowedCats = new Set(options.filterCategory);
      cases = cases.filter((c) => c.category && allowedCats.has(c.category));
    }
    if (options?.filterTags && options.filterTags.length > 0) {
      const allowedTags = new Set(options.filterTags);
      cases = cases.filter((c) => c.tags && c.tags.some((t) => allowedTags.has(t)));
    }

    // 2. Optional warmup runs
    const warmupCount = options?.warmupIterations ?? 0;
    if (warmupCount > 0 && cases.length > 0) {
      const warmupCase = cases[0];
      for (let i = 0; i < warmupCount; i++) {
        try {
          await executor(warmupCase);
        } catch {
          // Warmup failures are ignored
        }
      }
    }

    // 3. Execute benchmark cases
    const results: BenchmarkScenarioResult[] = [];
    const iterations = options?.iterationsPerCase ?? 1;

    for (const benchmarkCase of cases) {
      let bestResult: BenchmarkScenarioResult | null = null;
      let lowestLatency = Infinity;

      for (let iter = 0; iter < iterations; iter++) {
        let completion: string | null = null;
        let latencyMs = 0;
        let tokenCount = 0;
        let error: string | undefined;

        try {
          const execRes = await executor(benchmarkCase);
          completion = execRes.completion;
          latencyMs = execRes.latencyMs;
          tokenCount = execRes.tokenCount ?? (completion ? completion.split(/\s+/).length : 0);
        } catch (err) {
          error = err instanceof Error ? err.message : String(err);
          latencyMs = options?.timeoutMs ?? 2000;
        }

        const exactMatch = isExactMatch(completion, benchmarkCase.expectedCompletion);
        const prefixMatch = isPrefixMatch(completion, benchmarkCase.expectedCompletion);
        const similarityScore =
          benchmarkCase.expectedCompletion && completion
            ? computeNormalizedSimilarity(completion, benchmarkCase.expectedCompletion)
            : 0;

        const currentResult: BenchmarkScenarioResult = {
          caseId: benchmarkCase.id,
          name: benchmarkCase.name,
          language: benchmarkCase.language,
          latencyMs,
          generatedCompletion: completion,
          expectedCompletion: benchmarkCase.expectedCompletion,
          exactMatch,
          prefixMatch,
          similarityScore,
          tokenCount,
          category: benchmarkCase.category,
          error,
        };

        if (latencyMs < lowestLatency || !bestResult) {
          lowestLatency = latencyMs;
          bestResult = currentResult;
        }
      }

      if (bestResult) {
        results.push(bestResult);
      }
    }

    const durationMs = Date.now() - startTime;
    return this.calculateSummary(cases.length, results, durationMs, options?.metadata);
  }

  /**
   * Aggregate individual results into a comprehensive summary.
   */
  private calculateSummary(
    totalCases: number,
    results: readonly BenchmarkScenarioResult[],
    durationMs: number,
    metadata?: Record<string, unknown>
  ): BenchmarkSummary {
    const latencies = results.map((r) => r.latencyMs);
    const latencyMetrics = computePercentiles(latencies);

    const completedCases = results.filter((r) => !r.error && r.generatedCompletion !== null).length;
    const failedCases = results.length - completedCases;

    const evaluatedCases = results.filter((r) => r.expectedCompletion !== undefined);
    const exactMatchCount = evaluatedCases.filter((r) => r.exactMatch).length;
    const prefixMatchCount = evaluatedCases.filter((r) => r.prefixMatch).length;
    const meanSimilarity =
      evaluatedCases.length > 0
        ? Math.round(
            (evaluatedCases.reduce((acc, r) => acc + r.similarityScore, 0) /
              evaluatedCases.length) *
              100
          ) / 100
        : 0;

    const exactMatchRate =
      evaluatedCases.length > 0
        ? Math.round((exactMatchCount / evaluatedCases.length) * 100) / 100
        : 0;
    const prefixMatchRate =
      evaluatedCases.length > 0
        ? Math.round((prefixMatchCount / evaluatedCases.length) * 100) / 100
        : 0;

    // Language breakdown
    const languageBreakdown: Record<string, GroupMetrics> = {};
    const langGroups = new Map<string, BenchmarkScenarioResult[]>();
    for (const r of results) {
      const list = langGroups.get(r.language) || [];
      list.push(r);
      langGroups.set(r.language, list);
    }

    for (const [lang, items] of langGroups.entries()) {
      const evaluated = items.filter((r) => r.expectedCompletion !== undefined);
      const exact = evaluated.filter((r) => r.exactMatch).length;
      const prefix = evaluated.filter((r) => r.prefixMatch).length;
      const sim =
        evaluated.length > 0
          ? Math.round(
              (evaluated.reduce((acc, r) => acc + r.similarityScore, 0) / evaluated.length) * 100
            ) / 100
          : 0;

      const avgLat =
        items.length > 0
          ? Math.round(items.reduce((acc, r) => acc + r.latencyMs, 0) / items.length)
          : 0;

      languageBreakdown[lang] = {
        count: items.length,
        meanLatencyMs: avgLat,
        exactMatchRate: evaluated.length > 0 ? Math.round((exact / evaluated.length) * 100) / 100 : 0,
        prefixMatchRate: evaluated.length > 0 ? Math.round((prefix / evaluated.length) * 100) / 100 : 0,
        meanSimilarity: sim,
      };
    }

    // Category breakdown
    const categoryBreakdown: Record<string, GroupMetrics> = {};
    const catGroups = new Map<string, BenchmarkScenarioResult[]>();
    for (const r of results) {
      const cat = r.category || "uncategorized";
      const list = catGroups.get(cat) || [];
      list.push(r);
      catGroups.set(cat, list);
    }

    for (const [cat, items] of catGroups.entries()) {
      const evaluated = items.filter((r) => r.expectedCompletion !== undefined);
      const exact = evaluated.filter((r) => r.exactMatch).length;
      const prefix = evaluated.filter((r) => r.prefixMatch).length;
      const sim =
        evaluated.length > 0
          ? Math.round(
              (evaluated.reduce((acc, r) => acc + r.similarityScore, 0) / evaluated.length) * 100
            ) / 100
          : 0;

      const avgLat =
        items.length > 0
          ? Math.round(items.reduce((acc, r) => acc + r.latencyMs, 0) / items.length)
          : 0;

      categoryBreakdown[cat] = {
        count: items.length,
        meanLatencyMs: avgLat,
        exactMatchRate: evaluated.length > 0 ? Math.round((exact / evaluated.length) * 100) / 100 : 0,
        prefixMatchRate: evaluated.length > 0 ? Math.round((prefix / evaluated.length) * 100) / 100 : 0,
        meanSimilarity: sim,
      };
    }

    return {
      totalCases,
      completedCases,
      failedCases,
      latency: latencyMetrics,
      accuracy: {
        totalEvaluated: evaluatedCases.length,
        exactMatchCount,
        exactMatchRate,
        prefixMatchCount,
        prefixMatchRate,
        meanSimilarity,
      },
      languageBreakdown,
      categoryBreakdown,
      results,
      durationMs,
      timestamp: new Date().toISOString(),
      metadata,
    };
  }

  /**
   * Format a human-readable Markdown benchmark report.
   */
  formatMarkdownReport(summary: BenchmarkSummary): string {
    const lines: string[] = [];

    lines.push("# Local Copilot — Benchmark Report");
    lines.push("");
    lines.push(`- **Date:** ${summary.timestamp}`);
    lines.push(`- **Total Cases:** ${summary.totalCases}`);
    lines.push(`- **Success Rate:** ${Math.round((summary.completedCases / (summary.totalCases || 1)) * 100)}% (${summary.completedCases}/${summary.totalCases})`);
    lines.push(`- **Total Run Duration:** ${summary.durationMs}ms`);
    if (summary.metadata?.model) {
      lines.push(`- **Model:** ${summary.metadata.model}`);
    }
    if (summary.metadata?.provider) {
      lines.push(`- **Provider:** ${summary.metadata.provider}`);
    }
    lines.push("");

    lines.push("## Latency Profile");
    lines.push("");
    lines.push("| Metric | Value |");
    lines.push("| :--- | :--- |");
    lines.push(`| **P50 (Median)** | \`${summary.latency.p50}ms\` |`);
    lines.push(`| **P90** | \`${summary.latency.p90}ms\` |`);
    lines.push(`| **P95** | \`${summary.latency.p95}ms\` |`);
    lines.push(`| **P99** | \`${summary.latency.p99}ms\` |`);
    lines.push(`| **Mean** | \`${summary.latency.mean}ms\` |`);
    lines.push(`| **Min / Max** | \`${summary.latency.min}ms\` / \`${summary.latency.max}ms\` |`);
    lines.push("");

    lines.push("## Quality & Accuracy");
    lines.push("");
    lines.push("| Metric | Score |");
    lines.push("| :--- | :--- |");
    lines.push(`| **Exact Match Rate** | \`${(summary.accuracy.exactMatchRate * 100).toFixed(1)}%\` (${summary.accuracy.exactMatchCount}/${summary.accuracy.totalEvaluated}) |`);
    lines.push(`| **Prefix Match Rate** | \`${(summary.accuracy.prefixMatchRate * 100).toFixed(1)}%\` (${summary.accuracy.prefixMatchCount}/${summary.accuracy.totalEvaluated}) |`);
    lines.push(`| **Mean Similarity** | \`${(summary.accuracy.meanSimilarity * 100).toFixed(1)}%\` |`);
    lines.push("");

    lines.push("## Language Breakdown");
    lines.push("");
    lines.push("| Language | Cases | Mean Latency | Prefix Match | Mean Similarity |");
    lines.push("| :--- | :--- | :--- | :--- | :--- |");
    for (const [lang, stats] of Object.entries(summary.languageBreakdown)) {
      lines.push(
        `| **${lang}** | ${stats.count} | \`${stats.meanLatencyMs}ms\` | \`${(stats.prefixMatchRate * 100).toFixed(0)}%\` | \`${(stats.meanSimilarity * 100).toFixed(0)}%\` |`
      );
    }
    lines.push("");

    lines.push("## Category Breakdown");
    lines.push("");
    lines.push("| Category | Cases | Mean Latency | Prefix Match | Mean Similarity |");
    lines.push("| :--- | :--- | :--- | :--- | :--- |");
    for (const [cat, stats] of Object.entries(summary.categoryBreakdown)) {
      lines.push(
        `| **${cat}** | ${stats.count} | \`${stats.meanLatencyMs}ms\` | \`${(stats.prefixMatchRate * 100).toFixed(0)}%\` | \`${(stats.meanSimilarity * 100).toFixed(0)}%\` |`
      );
    }
    lines.push("");

    return lines.join("\n");
  }

  /**
   * Format the summary as a JSON string.
   */
  formatJsonReport(summary: BenchmarkSummary): string {
    return JSON.stringify(summary, null, 2);
  }
}
