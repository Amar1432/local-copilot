/**
 * Benchmark & Evaluation Type Definitions
 */

export interface BenchmarkCase {
  readonly id: string;
  readonly name: string;
  readonly language: string;
  readonly documentUri?: string;
  readonly fullText: string;
  readonly cursorLine: number;
  readonly cursorCharacter: number;
  readonly expectedCompletion?: string;
  readonly category?: string;
  readonly tags?: readonly string[];
}

export interface BenchmarkScenarioResult {
  readonly caseId: string;
  readonly name: string;
  readonly language: string;
  readonly latencyMs: number;
  readonly generatedCompletion: string | null;
  readonly expectedCompletion?: string;
  readonly exactMatch: boolean;
  readonly prefixMatch: boolean;
  readonly similarityScore: number;
  readonly tokenCount: number;
  readonly category?: string;
  readonly error?: string;
}

export interface PercentileMetrics {
  readonly min: number;
  readonly max: number;
  readonly mean: number;
  readonly median: number;
  readonly p50: number;
  readonly p90: number;
  readonly p95: number;
  readonly p99: number;
}

export interface AccuracyMetrics {
  readonly totalEvaluated: number;
  readonly exactMatchCount: number;
  readonly exactMatchRate: number;
  readonly prefixMatchCount: number;
  readonly prefixMatchRate: number;
  readonly meanSimilarity: number;
}

export interface GroupMetrics {
  readonly count: number;
  readonly meanLatencyMs: number;
  readonly exactMatchRate: number;
  readonly prefixMatchRate: number;
  readonly meanSimilarity: number;
}

export interface BenchmarkSummary {
  readonly totalCases: number;
  readonly completedCases: number;
  readonly failedCases: number;
  readonly latency: PercentileMetrics;
  readonly accuracy: AccuracyMetrics;
  readonly languageBreakdown: Record<string, GroupMetrics>;
  readonly categoryBreakdown: Record<string, GroupMetrics>;
  readonly results: readonly BenchmarkScenarioResult[];
  readonly durationMs: number;
  readonly timestamp: string;
  readonly metadata?: Record<string, unknown>;
}

export interface BenchmarkOptions {
  readonly warmupIterations?: number;
  readonly iterationsPerCase?: number;
  readonly filterLanguage?: readonly string[];
  readonly filterCategory?: readonly string[];
  readonly filterTags?: readonly string[];
  readonly timeoutMs?: number;
  readonly metadata?: Record<string, unknown>;
}

export type CompletionExecutor = (
  benchmarkCase: BenchmarkCase,
  signal?: AbortSignal
) => Promise<{
  completion: string | null;
  latencyMs: number;
  tokenCount?: number;
}>;
