/**
 * Privacy-Safe Telemetry & Online Metrics Type Definitions
 */

import type { LatencyStats } from "./metrics-tracker";

export interface TelemetryLanguageStats {
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

/**
 * Anonymized, aggregate metrics payload.
 * Strictly avoids code content, file paths, tokens, prompts, or personal identifiers.
 */
export interface TelemetryPayload {
  readonly schemaVersion: string;
  readonly timestamp: string;
  readonly sessionId: string;
  readonly extensionVersion?: string;
  readonly provider: string;
  readonly model: string;
  readonly localOnly: boolean;
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
  readonly languages: Record<string, TelemetryLanguageStats>;
  readonly errorCounts: Record<string, number>;
}

export interface TelemetryConfig {
  readonly enabled: boolean;
  readonly localOnly: boolean;
  readonly endpoint?: string;
  readonly batchIntervalMs?: number;
}

export interface TelemetryMetadata {
  readonly sessionId: string;
  readonly extensionVersion?: string;
  readonly provider: string;
  readonly model: string;
  readonly localOnly: boolean;
}
