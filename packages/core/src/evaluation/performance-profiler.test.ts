import { describe, it, expect } from "vitest";
import { PerformanceProfiler } from "./performance-profiler";
import { FileContextExtractor } from "../context/file-context-extractor";

describe("PerformanceProfiler", () => {
  const profiler = new PerformanceProfiler();

  it("should profile synchronous operations and return percentiles", () => {
    let sum = 0;
    const result = profiler.profileSync(
      "Sync Math",
      (i) => {
        sum += i;
      },
      500,
      1.0
    );

    expect(result.iterations).toBe(500);
    expect(result.metrics.p50).toBeGreaterThanOrEqual(0);
    expect(result.opsPerSec).toBeGreaterThan(0);
    expect(result.targetMet).toBe(true);
    expect(sum).toBeGreaterThan(0);
  });

  it("should profile asynchronous operations and return percentiles", async () => {
    const result = await profiler.profileAsync(
      "Async Resolve",
      async () => {
        await Promise.resolve();
      },
      50,
      5.0
    );

    expect(result.iterations).toBe(50);
    expect(result.metrics.p50).toBeGreaterThanOrEqual(0);
    expect(result.targetMet).toBe(true);
  });

  it("should verify Context Build latency meets SLA (<20ms)", async () => {
    const extractor = new FileContextExtractor();
    const result = await profiler.profileContextBuild(extractor, 500, 20);

    expect(result.iterations).toBe(20);
    expect(result.metrics.p95).toBeLessThan(20.0);
    expect(result.targetMet).toBe(true);
  });

  it("should verify Cache Lookup latency meets SLA (<5ms)", () => {
    const map = new Map<string, unknown>();
    const mockCache = {
      get: (k: string) => map.get(k),
      set: (k: string, v: unknown) => {
        map.set(k, v);
      },
    };

    const result = profiler.profileCacheLookup(mockCache, 1000);
    expect(result.iterations).toBe(1000);
    expect(result.metrics.p95).toBeLessThan(5.0);
    expect(result.targetMet).toBe(true);
  });

  it("should verify FIM Formatting latency meets SLA (<2ms)", () => {
    const result = profiler.profileFimFormatting(500);
    expect(result.iterations).toBe(500);
    expect(result.metrics.p95).toBeLessThan(2.0);
    expect(result.targetMet).toBe(true);
  });

  it("should generate formatted markdown report", () => {
    const mockResults = [
      {
        name: "Context Build",
        iterations: 100,
        metrics: { min: 1, max: 8, mean: 3.5, median: 3, p50: 3, p90: 6, p95: 7, p99: 8 },
        opsPerSec: 285.71,
        targetMet: true,
        targetMs: 20,
      },
      {
        name: "Cache Lookup",
        iterations: 1000,
        metrics: { min: 0.01, max: 0.2, mean: 0.05, median: 0.04, p50: 0.04, p90: 0.08, p95: 0.1, p99: 0.15 },
        opsPerSec: 20000,
        targetMet: true,
        targetMs: 5,
      },
    ];

    const report = profiler.formatReport(mockResults);
    expect(report).toContain("# Performance Profiling Report");
    expect(report).toContain("Context Build");
    expect(report).toContain("Cache Lookup");
    expect(report).toContain("✅ PASS");
  });
});
