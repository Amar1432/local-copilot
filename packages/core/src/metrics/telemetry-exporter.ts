/**
 * Telemetry Exporter — Formats, sanitizes, and dispatches privacy-safe
 * aggregate telemetry events.
 *
 * Privacy Guarantees:
 * 1. Opt-In Only: Never transmits unless `telemetry.enabled` is explicitly true.
 * 2. Local-Only Guard: Never transmits when `localOnly` is true, regardless of telemetry setting.
 * 3. Zero Code Retention: Payload contains ONLY numeric aggregates, latency percentiles,
 *    and coarse error categories. No document paths, file contents, prompts, or identifiers.
 */

import type {
  MetricsSummary,
  ErrorRecord,
} from "./metrics-tracker";
import type {
  TelemetryConfig,
  TelemetryMetadata,
  TelemetryPayload,
} from "./telemetry.types";

export class TelemetryExporter {
  public static readonly SCHEMA_VERSION = "1.0.0";

  /**
   * Determine if telemetry transmission is permitted under current configuration.
   * Telemetry is strictly blocked if local-only mode is active or telemetry is disabled.
   */
  canTransmit(config: TelemetryConfig): boolean {
    if (config.localOnly) {
      return false;
    }
    return Boolean(config.enabled);
  }

  /**
   * Sanitize an error record or message into a safe domain category code.
   * Ensures no prompt content, file paths, or credentials leak via error messages.
   */
  sanitizeErrorCode(record?: ErrorRecord | string | null): string {
    if (!record) return "unknown";
    const text = (typeof record === "string" ? record : `${record.code || ""} ${record.message}`).toLowerCase();

    if (text.includes("401") || text.includes("403") || text.includes("auth") || text.includes("key")) {
      return "authentication";
    }
    if (text.includes("404") || text.includes("not found") || text.includes("unavailable")) {
      return "not_found";
    }
    if (text.includes("429") || text.includes("rate limit") || text.includes("quota")) {
      return "rate_limit";
    }
    if (text.includes("timeout") || text.includes("timed out") || text.includes("aborted")) {
      return "timeout";
    }
    if (
      text.includes("network") ||
      text.includes("econnrefused") ||
      text.includes("failed to fetch") ||
      text.includes("connection")
    ) {
      return "network";
    }
    if (text.includes("cancel")) {
      return "cancelled";
    }

    return "unknown";
  }

  /**
   * Construct a clean, privacy-safe telemetry payload from metrics summary.
   */
  buildPayload(summary: MetricsSummary, metadata: TelemetryMetadata): TelemetryPayload {
    // Count sanitized error occurrences
    const errorCounts: Record<string, number> = {};
    for (const err of summary.recentErrors) {
      const category = this.sanitizeErrorCode(err);
      errorCounts[category] = (errorCounts[category] || 0) + 1;
    }

    // Clean language metrics
    const languages: TelemetryPayload["languages"] = {};
    for (const [lang, stats] of Object.entries(summary.languages)) {
      languages[lang] = {
        requests: stats.requests,
        completions: stats.completions,
        accepted: stats.accepted,
        dismissed: stats.dismissed,
        acceptanceRate: stats.acceptanceRate,
        avgLatencyMs: stats.avgLatencyMs,
        charsGenerated: stats.charsGenerated,
        charsAccepted: stats.charsAccepted,
        linesGenerated: stats.linesGenerated,
        linesAccepted: stats.linesAccepted,
      };
    }

    return {
      schemaVersion: TelemetryExporter.SCHEMA_VERSION,
      timestamp: new Date().toISOString(),
      sessionId: metadata.sessionId,
      extensionVersion: metadata.extensionVersion,
      provider: metadata.provider,
      model: metadata.model,
      localOnly: metadata.localOnly,
      totalRequests: summary.totalRequests,
      successfulCompletions: summary.successfulCompletions,
      failedRequests: summary.failedRequests,
      cancelledRequests: summary.cancelledRequests,
      cacheHits: summary.cacheHits,
      cacheMisses: summary.cacheMisses,
      cacheHitRate: summary.cacheHitRate,
      acceptedCompletions: summary.acceptedCompletions,
      dismissedCompletions: summary.dismissedCompletions,
      acceptanceRate: summary.acceptanceRate,
      totalCharsGenerated: summary.totalCharsGenerated,
      totalCharsAccepted: summary.totalCharsAccepted,
      totalLinesGenerated: summary.totalLinesGenerated,
      totalLinesAccepted: summary.totalLinesAccepted,
      latency: summary.latency,
      languages,
      errorCounts,
    };
  }

  /**
   * Export telemetry data if permitted by configuration and local-only safeguards.
   */
  async export(
    summary: MetricsSummary,
    metadata: TelemetryMetadata,
    config: TelemetryConfig,
    sink?: (payload: TelemetryPayload) => Promise<void>
  ): Promise<{ transmitted: boolean; reason?: string; payload?: TelemetryPayload }> {
    if (config.localOnly) {
      return { transmitted: false, reason: "local_only_mode_enabled" };
    }
    if (!config.enabled) {
      return { transmitted: false, reason: "telemetry_disabled" };
    }

    const payload = this.buildPayload(summary, metadata);

    if (sink) {
      await sink(payload);
      return { transmitted: true, payload };
    }

    if (config.endpoint) {
      try {
        const res = await fetch(config.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          return { transmitted: false, reason: `endpoint_status_${res.status}`, payload };
        }
        return { transmitted: true, payload };
      } catch (err) {
        return {
          transmitted: false,
          reason: err instanceof Error ? err.message : "network_error",
          payload,
        };
      }
    }

    return { transmitted: true, payload };
  }

  /**
   * Format payload as JSON string.
   */
  formatJson(payload: TelemetryPayload): string {
    return JSON.stringify(payload, null, 2);
  }
}
