/**
 * Performance Profiler — Benchmarks context extraction, cache lookups,
 * and completion assembly against strict latency SLAs.
 *
 * SLAs:
 * - Context Build: <20ms (P50 <5ms, P95 <15ms)
 * - Cache Lookup: <5ms (P50 <0.1ms, P95 <1ms)
 * - FIM / Prompt Assembly: <2ms (P50 <0.2ms, P95 <1ms)
 * - End-to-End Local Completion: P50 <300ms (on local target runtime)
 */

import { computePercentiles } from "./similarity";
import type { PercentileMetrics } from "./evaluation.types";
import type { ContextProvider, ContextTarget, ContextBudget } from "../context/context.types";
import { formatFimPrompt } from "../providers/fim";

export interface ProfileResult {
  readonly name: string;
  readonly iterations: number;
  readonly metrics: PercentileMetrics;
  readonly opsPerSec: number;
  readonly targetMet: boolean;
  readonly targetMs?: number;
}

export class PerformanceProfiler {
  /**
   * Profile a synchronous function over multiple iterations using high-precision timers.
   */
  profileSync(
    name: string,
    fn: (iter: number) => void,
    iterations = 1000,
    targetMs?: number
  ): ProfileResult {
    const latencies: number[] = [];
    const overallStart = performance.now();

    for (let i = 0; i < iterations; i++) {
      const t0 = performance.now();
      fn(i);
      const t1 = performance.now();
      latencies.push(Math.max(0, t1 - t0));
    }

    const overallDurationMs = performance.now() - overallStart;
    const metrics = computePercentiles(latencies);
    const opsPerSec = Math.round((iterations / (overallDurationMs / 1000)) * 100) / 100;
    const targetMet = targetMs !== undefined ? metrics.p95 <= targetMs : true;

    return {
      name,
      iterations,
      metrics,
      opsPerSec,
      targetMet,
      targetMs,
    };
  }

  /**
   * Profile an asynchronous function over multiple iterations using high-precision timers.
   */
  async profileAsync(
    name: string,
    fn: (iter: number) => Promise<void>,
    iterations = 100,
    targetMs?: number
  ): Promise<ProfileResult> {
    const latencies: number[] = [];
    const overallStart = performance.now();

    for (let i = 0; i < iterations; i++) {
      const t0 = performance.now();
      await fn(i);
      const t1 = performance.now();
      latencies.push(Math.max(0, t1 - t0));
    }

    const overallDurationMs = performance.now() - overallStart;
    const metrics = computePercentiles(latencies);
    const opsPerSec = Math.round((iterations / (overallDurationMs / 1000)) * 100) / 100;
    const targetMet = targetMs !== undefined ? metrics.p95 <= targetMs : true;

    return {
      name,
      iterations,
      metrics,
      opsPerSec,
      targetMet,
      targetMs,
    };
  }

  /**
   * Benchmark Context Extraction on synthetic multi-line documents (target: P95 < 20ms).
   */
  async profileContextBuild(
    extractor: ContextProvider,
    linesCount = 1000,
    iterations = 50
  ): Promise<ProfileResult> {
    const sampleLines: string[] = [];
    sampleLines.push('import { useState, useEffect } from "react";');
    sampleLines.push('import { formatFimPrompt } from "./fim";');
    for (let i = 0; i < linesCount; i++) {
      sampleLines.push(`export function helperFunction_${i}(arg: number): number {\n  return arg * 2 + ${i};\n}`);
    }
    sampleLines.push("export function mainProcess(input: string) {\n  const res = ");
    const fullText = sampleLines.join("\n");

    const target: ContextTarget = {
      documentUri: "file:///workspace/src/profiler-test.ts",
      documentVersion: 1,
      language: "typescript",
      fullText,
      prefix: fullText.substring(0, fullText.length - 10),
      suffix: "\n  return res;\n}",
      position: { line: sampleLines.length - 1, character: 14 },
    };

    const budget: ContextBudget = {
      maxTokens: 1024,
      maxChunks: 10,
    };

    return this.profileAsync(
      `Context Build (${linesCount} lines)`,
      async () => {
        await extractor.getContext(target, budget);
      },
      iterations,
      20.0 // Target SLA: <20ms
    );
  }

  /**
   * Benchmark Cache Lookups and Insertions (target: P95 < 5ms).
   */
  profileCacheLookup(
    cache: { get: (k: string) => unknown; set: (k: string, v: unknown) => void },
    count = 5000
  ): ProfileResult {
    // Pre-populate cache
    for (let i = 0; i < 100; i++) {
      cache.set(`fp-test-key-${i}`, `completion-result-${i}`);
    }

    return this.profileSync(
      `Cache Lookup & Retrieval (${count} ops)`,
      (i) => {
        const key = `fp-test-key-${i % 100}`;
        cache.get(key);
      },
      count,
      5.0 // Target SLA: <5ms
    );
  }

  /**
   * Benchmark FIM Prompt formatting and token budgeting (target: P95 < 2ms).
   */
  profileFimFormatting(count = 2000): ProfileResult {
    const prefix = "export async function calculateFibonacci(n: number): Promise<number> {\n  if (n <= 1) return n;\n  return ";
    const suffix = ";\n}\n";

    return this.profileSync(
      `FIM Prompt Assembly (${count} ops)`,
      () => {
        formatFimPrompt(prefix, suffix, "qwen");
      },
      count,
      2.0 // Target SLA: <2ms
    );
  }

  /**
   * Generate a formatted Markdown performance profile report.
   */
  formatReport(results: readonly ProfileResult[]): string {
    const lines: string[] = [];
    lines.push("# Performance Profiling Report");
    lines.push("");
    lines.push("| Benchmark | Iterations | P50 (ms) | P95 (ms) | Mean (ms) | Min/Max (ms) | Ops/sec | SLA Status |");
    lines.push("| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |");

    for (const r of results) {
      const status = r.targetMet ? "✅ PASS" : "⚠️ SLOW";
      const targetNote = r.targetMs ? ` (<${r.targetMs}ms)` : "";
      lines.push(
        `| **${r.name}** | ${r.iterations} | \`${r.metrics.p50}ms\` | \`${r.metrics.p95}ms\`${targetNote} | \`${r.metrics.mean}ms\` | \`${r.metrics.min}ms\` / \`${r.metrics.max}ms\` | ${r.opsPerSec} | ${status} |`
      );
    }
    lines.push("");

    return lines.join("\n");
  }
}
