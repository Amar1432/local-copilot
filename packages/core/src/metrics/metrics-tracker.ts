/**
 * Completion Metrics Tracker — Tracks and calculates metrics for completions:
 * - Request counts (total, success, failed, cancelled)
 * - Cache hits / misses and hit rate
 * - Acceptance rate and dismissal counts
 * - Latency statistics (P50, P90, P95, P99, average, min, max)
 * - Code volume (characters and lines generated vs accepted)
 * - Language breakdown
 * - Recent error history
 */

export interface LatencyStats {
  readonly count: number;
  readonly minMs: number | null;
  readonly maxMs: number | null;
  readonly avgMs: number | null;
  readonly p50Ms: number | null;
  readonly p90Ms: number | null;
  readonly p95Ms: number | null;
  readonly p99Ms: number | null;
  readonly lastMs: number | null;
}

export interface LanguageMetrics {
  readonly language: string;
  readonly requests: number;
  readonly completions: number;
  readonly accepted: number;
  readonly dismissed: number;
  readonly acceptanceRate: number;
  readonly avgLatencyMs: number | null;
  readonly charsGenerated: number;
  readonly charsAccepted: number;
  readonly linesGenerated: number;
  readonly linesAccepted: number;
}

export interface ErrorRecord {
  readonly timestamp: number;
  readonly message: string;
  readonly code?: string;
  readonly provider?: string;
  readonly language?: string;
  readonly latencyMs?: number;
}

export interface MetricsSummary {
  readonly totalRequests: number;
  readonly successfulCompletions: number;
  readonly failedRequests: number;
  readonly cancelledRequests: number;
  readonly cacheHits: number;
  readonly cacheMisses: number;
  readonly cacheHitRate: number;
  readonly acceptedCompletions: number;
  readonly dismissedCompletions: number;
  readonly acceptanceRate: number;
  readonly totalCharsGenerated: number;
  readonly totalCharsAccepted: number;
  readonly totalLinesGenerated: number;
  readonly totalLinesAccepted: number;
  readonly latency: LatencyStats;
  readonly languages: Record<string, LanguageMetrics>;
  readonly recentErrors: readonly ErrorRecord[];
}

export interface RecordSuccessOptions {
  readonly latencyMs: number;
  readonly text: string;
  readonly language: string;
  readonly provider?: string;
  readonly model?: string;
  readonly cached?: boolean;
  readonly id?: string;
}

export interface RecordAcceptanceOptions {
  readonly id?: string;
  readonly latencyMs?: number;
  readonly text?: string;
  readonly language?: string;
  readonly charCount?: number;
  readonly lineCount?: number;
}

export interface RecordFailureOptions {
  readonly message: string;
  readonly code?: string;
  readonly latencyMs?: number;
  readonly language?: string;
  readonly provider?: string;
}

const MAX_LATENCY_HISTORY = 1000;
const MAX_ERROR_HISTORY = 50;

/**
 * In-memory completion metrics tracker.
 */
export class CompletionMetricsTracker {
  private totalRequests = 0;
  private successfulCompletions = 0;
  private failedRequests = 0;
  private cancelledRequests = 0;
  private cacheHits = 0;
  private cacheMisses = 0;
  private acceptedCompletions = 0;
  private dismissedCompletions = 0;
  private totalCharsGenerated = 0;
  private totalCharsAccepted = 0;
  private totalLinesGenerated = 0;
  private totalLinesAccepted = 0;

  private readonly latencies: number[] = [];
  private readonly errors: ErrorRecord[] = [];
  private readonly languageStats = new Map<
    string,
    {
      requests: number;
      completions: number;
      accepted: number;
      dismissed: number;
      latencies: number[];
      charsGenerated: number;
      charsAccepted: number;
      linesGenerated: number;
      linesAccepted: number;
    }
  >();

  /**
   * Record a completion request initiated.
   */
  recordRequest(options?: { language?: string; provider?: string; model?: string }): void {
    this.totalRequests += 1;
    if (options?.language) {
      const lang = this.getOrCreateLanguage(options.language);
      lang.requests += 1;
    }
  }

  /**
   * Record a successfully generated completion.
   */
  recordSuccess(options: RecordSuccessOptions): void {
    this.successfulCompletions += 1;
    const chars = options.text.length;
    const lines = countLines(options.text);

    this.totalCharsGenerated += chars;
    this.totalLinesGenerated += lines;

    this.addLatency(options.latencyMs);

    const lang = this.getOrCreateLanguage(options.language);
    lang.completions += 1;
    lang.charsGenerated += chars;
    lang.linesGenerated += lines;
    lang.latencies.push(options.latencyMs);
    if (lang.latencies.length > MAX_LATENCY_HISTORY) {
      lang.latencies.shift();
    }
  }

  /**
   * Record when an inline completion suggestion is accepted by the user.
   */
  recordAcceptance(options: RecordAcceptanceOptions): void {
    this.acceptedCompletions += 1;

    let chars = options.charCount ?? 0;
    let lines = options.lineCount ?? 0;

    if (options.text) {
      chars = options.text.length;
      lines = countLines(options.text);
    }

    this.totalCharsAccepted += chars;
    this.totalLinesAccepted += lines;

    if (options.language) {
      const lang = this.getOrCreateLanguage(options.language);
      lang.accepted += 1;
      lang.charsAccepted += chars;
      lang.linesAccepted += lines;
    }
  }

  /**
   * Record when a suggestion is rejected or dismissed.
   */
  recordDismissal(options?: { id?: string; language?: string }): void {
    this.dismissedCompletions += 1;
    if (options?.language) {
      const lang = this.getOrCreateLanguage(options.language);
      lang.dismissed += 1;
    }
  }

  /**
   * Record a failed completion request.
   */
  recordFailure(options: RecordFailureOptions): void {
    this.failedRequests += 1;
    if (options.latencyMs !== undefined) {
      this.addLatency(options.latencyMs);
    }

    this.errors.unshift({
      timestamp: Date.now(),
      message: options.message,
      code: options.code,
      provider: options.provider,
      language: options.language,
      latencyMs: options.latencyMs,
    });

    if (this.errors.length > MAX_ERROR_HISTORY) {
      this.errors.pop();
    }
  }

  /**
   * Record a cancelled completion request.
   */
  recordCancellation(options?: { latencyMs?: number; language?: string }): void {
    this.cancelledRequests += 1;
    if (options?.latencyMs !== undefined) {
      this.addLatency(options.latencyMs);
    }
  }

  /**
   * Record a cache hit.
   */
  recordCacheHit(options?: { language?: string; latencyMs?: number }): void {
    this.cacheHits += 1;
    if (options?.latencyMs !== undefined) {
      this.addLatency(options.latencyMs);
    }
  }

  /**
   * Record a cache miss.
   */
  recordCacheMiss(_options?: { language?: string }): void {
    this.cacheMisses += 1;
  }

  /**
   * Calculate summary metrics.
   */
  getSummary(): MetricsSummary {
    const totalCacheLookups = this.cacheHits + this.cacheMisses;
    const cacheHitRate = totalCacheLookups > 0 ? this.cacheHits / totalCacheLookups : 0;

    const totalDecisions = this.acceptedCompletions + this.dismissedCompletions;
    const acceptanceRate =
      totalDecisions > 0
        ? this.acceptedCompletions / totalDecisions
        : this.successfulCompletions > 0
          ? this.acceptedCompletions / this.successfulCompletions
          : 0;

    const latency = this.calculateLatencyStats(this.latencies);

    const languages: Record<string, LanguageMetrics> = {};
    for (const [name, stats] of this.languageStats.entries()) {
      const langDecisions = stats.accepted + stats.dismissed;
      const langAcceptanceRate =
        langDecisions > 0
          ? stats.accepted / langDecisions
          : stats.completions > 0
            ? stats.accepted / stats.completions
            : 0;
      const langAvgLatency =
        stats.latencies.length > 0
          ? Math.round(
              stats.latencies.reduce((acc, v) => acc + v, 0) / stats.latencies.length
            )
          : null;

      languages[name] = {
        language: name,
        requests: stats.requests,
        completions: stats.completions,
        accepted: stats.accepted,
        dismissed: stats.dismissed,
        acceptanceRate: langAcceptanceRate,
        avgLatencyMs: langAvgLatency,
        charsGenerated: stats.charsGenerated,
        charsAccepted: stats.charsAccepted,
        linesGenerated: stats.linesGenerated,
        linesAccepted: stats.linesAccepted,
      };
    }

    return {
      totalRequests: this.totalRequests,
      successfulCompletions: this.successfulCompletions,
      failedRequests: this.failedRequests,
      cancelledRequests: this.cancelledRequests,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      cacheHitRate,
      acceptedCompletions: this.acceptedCompletions,
      dismissedCompletions: this.dismissedCompletions,
      acceptanceRate,
      totalCharsGenerated: this.totalCharsGenerated,
      totalCharsAccepted: this.totalCharsAccepted,
      totalLinesGenerated: this.totalLinesGenerated,
      totalLinesAccepted: this.totalLinesAccepted,
      latency,
      languages,
      recentErrors: [...this.errors],
    };
  }

  /**
   * Get metrics for a specific language.
   */
  getLanguageMetrics(language: string): LanguageMetrics | null {
    const summary = this.getSummary();
    return summary.languages[language] ?? null;
  }

  /**
   * Get recent latency values.
   */
  getRecentLatencies(): readonly number[] {
    return [...this.latencies];
  }

  /**
   * Get recent errors.
   */
  getRecentErrors(limit = 10): readonly ErrorRecord[] {
    return this.errors.slice(0, limit);
  }

  /**
   * Reset all collected metrics.
   */
  reset(): void {
    this.totalRequests = 0;
    this.successfulCompletions = 0;
    this.failedRequests = 0;
    this.cancelledRequests = 0;
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.acceptedCompletions = 0;
    this.dismissedCompletions = 0;
    this.totalCharsGenerated = 0;
    this.totalCharsAccepted = 0;
    this.totalLinesGenerated = 0;
    this.totalLinesAccepted = 0;
    this.latencies.length = 0;
    this.errors.length = 0;
    this.languageStats.clear();
  }

  private addLatency(ms: number): void {
    if (typeof ms !== "number" || isNaN(ms) || ms < 0) return;
    this.latencies.push(ms);
    if (this.latencies.length > MAX_LATENCY_HISTORY) {
      this.latencies.shift();
    }
  }

  private calculateLatencyStats(values: readonly number[]): LatencyStats {
    if (values.length === 0) {
      return {
        count: 0,
        minMs: null,
        maxMs: null,
        avgMs: null,
        p50Ms: null,
        p90Ms: null,
        p95Ms: null,
        p99Ms: null,
        lastMs: null,
      };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const count = sorted.length;
    const sum = sorted.reduce((acc, v) => acc + v, 0);
    const avgMs = Math.round(sum / count);
    const minMs = sorted[0];
    const maxMs = sorted[count - 1];
    const lastMs = values[values.length - 1];

    return {
      count,
      minMs,
      maxMs,
      avgMs,
      p50Ms: calculatePercentile(sorted, 50),
      p90Ms: calculatePercentile(sorted, 90),
      p95Ms: calculatePercentile(sorted, 95),
      p99Ms: calculatePercentile(sorted, 99),
      lastMs,
    };
  }

  private getOrCreateLanguage(language: string) {
    let stats = this.languageStats.get(language);
    if (!stats) {
      stats = {
        requests: 0,
        completions: 0,
        accepted: 0,
        dismissed: 0,
        latencies: [],
        charsGenerated: 0,
        charsAccepted: 0,
        linesGenerated: 0,
        linesAccepted: 0,
      };
      this.languageStats.set(language, stats);
    }
    return stats;
  }
}

function calculatePercentile(sorted: readonly number[], percentile: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  const safeIndex = Math.max(0, Math.min(sorted.length - 1, index));
  return sorted[safeIndex];
}

function countLines(text: string): number {
  if (!text) return 0;
  return text.split("\n").length;
}
