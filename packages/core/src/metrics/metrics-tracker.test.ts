import { describe, it, expect, beforeEach } from "vitest";
import { CompletionMetricsTracker } from "./metrics-tracker";

describe("CompletionMetricsTracker", () => {
  let tracker: CompletionMetricsTracker;

  beforeEach(() => {
    tracker = new CompletionMetricsTracker();
  });

  it("should initialize with zero counts and empty latency stats", () => {
    const summary = tracker.getSummary();
    expect(summary.totalRequests).toBe(0);
    expect(summary.successfulCompletions).toBe(0);
    expect(summary.failedRequests).toBe(0);
    expect(summary.cancelledRequests).toBe(0);
    expect(summary.cacheHits).toBe(0);
    expect(summary.cacheMisses).toBe(0);
    expect(summary.cacheHitRate).toBe(0);
    expect(summary.acceptedCompletions).toBe(0);
    expect(summary.dismissedCompletions).toBe(0);
    expect(summary.acceptanceRate).toBe(0);
    expect(summary.totalCharsGenerated).toBe(0);
    expect(summary.totalLinesGenerated).toBe(0);
    expect(summary.latency.count).toBe(0);
    expect(summary.latency.p50Ms).toBeNull();
    expect(summary.latency.avgMs).toBeNull();
    expect(summary.recentErrors).toEqual([]);
  });

  it("should track request counts and per-language requests", () => {
    tracker.recordRequest({ language: "typescript" });
    tracker.recordRequest({ language: "typescript" });
    tracker.recordRequest({ language: "python" });

    const summary = tracker.getSummary();
    expect(summary.totalRequests).toBe(3);
    expect(summary.languages.typescript.requests).toBe(2);
    expect(summary.languages.python.requests).toBe(1);
  });

  it("should track successful completions with latency and character/line counts", () => {
    tracker.recordRequest({ language: "typescript" });
    tracker.recordSuccess({
      latencyMs: 120,
      text: "const x = 10;\nconst y = 20;",
      language: "typescript",
      model: "qwen-coder",
      provider: "ollama",
    });

    const summary = tracker.getSummary();
    expect(summary.successfulCompletions).toBe(1);
    expect(summary.totalCharsGenerated).toBe(27);
    expect(summary.totalLinesGenerated).toBe(2);
    expect(summary.latency.count).toBe(1);
    expect(summary.latency.minMs).toBe(120);
    expect(summary.latency.maxMs).toBe(120);
    expect(summary.latency.avgMs).toBe(120);
    expect(summary.latency.p50Ms).toBe(120);
    expect(summary.latency.lastMs).toBe(120);

    const ts = tracker.getLanguageMetrics("typescript");
    expect(ts?.completions).toBe(1);
    expect(ts?.charsGenerated).toBe(27);
    expect(ts?.linesGenerated).toBe(2);
    expect(ts?.avgLatencyMs).toBe(120);
  });

  it("should accurately calculate latency percentiles (P50, P90, P95, P99)", () => {
    // Insert latencies: 10, 20, 30, 40, 50, 60, 70, 80, 90, 100
    for (let i = 1; i <= 10; i++) {
      tracker.recordSuccess({
        latencyMs: i * 10,
        text: `line ${i}`,
        language: "typescript",
      });
    }

    const summary = tracker.getSummary();
    expect(summary.latency.count).toBe(10);
    expect(summary.latency.minMs).toBe(10);
    expect(summary.latency.maxMs).toBe(100);
    expect(summary.latency.avgMs).toBe(55);
    expect(summary.latency.p50Ms).toBe(50);
    expect(summary.latency.p90Ms).toBe(90);
    expect(summary.latency.p95Ms).toBe(100);
    expect(summary.latency.p99Ms).toBe(100);
    expect(summary.latency.lastMs).toBe(100);
  });

  it("should track cache hits, misses, and calculate cache hit rate", () => {
    tracker.recordCacheMiss();
    tracker.recordCacheMiss();
    tracker.recordCacheHit({ latencyMs: 5 });
    tracker.recordCacheHit({ latencyMs: 3 });

    const summary = tracker.getSummary();
    expect(summary.cacheHits).toBe(2);
    expect(summary.cacheMisses).toBe(2);
    expect(summary.cacheHitRate).toBe(0.5);
  });

  it("should track acceptance rate, accepted characters and lines", () => {
    // Generate 4 completions
    for (let i = 0; i < 4; i++) {
      tracker.recordSuccess({
        latencyMs: 100,
        text: "function test() {\n  return 42;\n}",
        language: "typescript",
      });
    }

    // Accept 3 completions, dismiss 1
    tracker.recordAcceptance({
      text: "function test() {\n  return 42;\n}",
      language: "typescript",
    });
    tracker.recordAcceptance({
      text: "function test() {\n  return 42;\n}",
      language: "typescript",
    });
    tracker.recordAcceptance({
      charCount: 30,
      lineCount: 3,
      language: "typescript",
    });
    tracker.recordDismissal({ language: "typescript" });

    const summary = tracker.getSummary();
    const text = "function test() {\n  return 42;\n}";
    const textChars = text.length;
    expect(summary.totalCharsAccepted).toBe(textChars * 2 + 30);
    expect(summary.totalLinesAccepted).toBe(3 * 2 + 3);

    const ts = summary.languages.typescript;
    expect(ts.accepted).toBe(3);
    expect(ts.dismissed).toBe(1);
    expect(ts.acceptanceRate).toBe(0.75);
  });

  it("should record failures and maintain recent error history", () => {
    tracker.recordFailure({
      message: "Connection refused",
      code: "ECONNREFUSED",
      provider: "ollama",
      language: "typescript",
      latencyMs: 50,
    });

    tracker.recordFailure({
      message: "Model not found",
      code: "404",
      provider: "openai",
      language: "python",
    });

    const summary = tracker.getSummary();
    expect(summary.failedRequests).toBe(2);
    expect(summary.recentErrors.length).toBe(2);
    expect(summary.recentErrors[0].message).toBe("Model not found");
    expect(summary.recentErrors[1].message).toBe("Connection refused");
    expect(summary.recentErrors[1].code).toBe("ECONNREFUSED");
  });

  it("should record cancellations", () => {
    tracker.recordCancellation({ latencyMs: 25 });
    tracker.recordCancellation({ latencyMs: 40 });

    const summary = tracker.getSummary();
    expect(summary.cancelledRequests).toBe(2);
  });

  it("should reset all metrics when reset() is called", () => {
    tracker.recordRequest({ language: "javascript" });
    tracker.recordSuccess({ latencyMs: 100, text: "foo", language: "javascript" });
    tracker.recordAcceptance({ text: "foo", language: "javascript" });
    tracker.recordFailure({ message: "error" });

    expect(tracker.getSummary().totalRequests).toBe(1);
    expect(tracker.getSummary().acceptedCompletions).toBe(1);

    tracker.reset();

    const summary = tracker.getSummary();
    expect(summary.totalRequests).toBe(0);
    expect(summary.successfulCompletions).toBe(0);
    expect(summary.acceptedCompletions).toBe(0);
    expect(summary.failedRequests).toBe(0);
    expect(summary.recentErrors).toEqual([]);
    expect(summary.latency.count).toBe(0);
  });
});
