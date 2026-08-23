import { describe, it, expect } from "vitest";
import { CompletionMetricsTracker } from "./metrics-tracker";
import { TelemetryExporter } from "./telemetry-exporter";

describe("TelemetryExporter", () => {
  const exporter = new TelemetryExporter();

  describe("canTransmit safeguards", () => {
    it("should return false if localOnly is true even if enabled is true", () => {
      expect(exporter.canTransmit({ enabled: true, localOnly: true })).toBe(false);
    });

    it("should return false if telemetry is disabled", () => {
      expect(exporter.canTransmit({ enabled: false, localOnly: false })).toBe(false);
      expect(exporter.canTransmit({ enabled: false, localOnly: true })).toBe(false);
    });

    it("should return true only when enabled is true and localOnly is false", () => {
      expect(exporter.canTransmit({ enabled: true, localOnly: false })).toBe(true);
    });
  });

  describe("sanitizeErrorCode", () => {
    it("should categorize authentication errors", () => {
      expect(exporter.sanitizeErrorCode("Error: 401 Unauthorized API key")).toBe("authentication");
      expect(exporter.sanitizeErrorCode({ timestamp: 1, message: "Invalid API auth key" })).toBe(
        "authentication"
      );
    });

    it("should categorize not found errors", () => {
      expect(exporter.sanitizeErrorCode("404 model not found")).toBe("not_found");
    });

    it("should categorize rate limit errors", () => {
      expect(exporter.sanitizeErrorCode("429 rate limit exceeded")).toBe("rate_limit");
    });

    it("should categorize timeouts and aborts", () => {
      expect(exporter.sanitizeErrorCode("Request timed out after 2000ms")).toBe("timeout");
      expect(exporter.sanitizeErrorCode("The operation was aborted")).toBe("timeout");
    });

    it("should categorize network errors", () => {
      expect(exporter.sanitizeErrorCode("connect ECONNREFUSED 127.0.0.1:11434")).toBe("network");
    });

    it("should fallback cleanly for unknown errors without leaking messages", () => {
      expect(
        exporter.sanitizeErrorCode("Unexpected internal server token error in /Users/secret/file.ts")
      ).toBe("unknown");
    });
  });

  describe("buildPayload & export", () => {
    it("should build aggregate payload with zero code retention", () => {
      const tracker = new CompletionMetricsTracker();

      tracker.recordRequest({ language: "typescript" });
      tracker.recordSuccess({
        latencyMs: 120,
        text: "const sensitiveUserSecretCode = 12345;",
        language: "typescript",
        provider: "custom",
        model: "qwen-coder",
      });
      tracker.recordAcceptance({
        language: "typescript",
        charCount: 38,
        lineCount: 1,
      });
      tracker.recordFailure({
        message: "Failed to connect to 127.0.0.1:11434 ECONNREFUSED",
        language: "typescript",
      });

      const summary = tracker.getSummary();
      const metadata = {
        sessionId: "test-session-123",
        extensionVersion: "0.1.0",
        provider: "custom",
        model: "qwen-coder",
        localOnly: false,
      };

      const payload = exporter.buildPayload(summary, metadata);

      expect(payload.schemaVersion).toBe(TelemetryExporter.SCHEMA_VERSION);
      expect(payload.sessionId).toBe("test-session-123");
      expect(payload.totalRequests).toBe(1);
      expect(payload.successfulCompletions).toBe(1);
      expect(payload.failedRequests).toBe(1);
      expect(payload.acceptedCompletions).toBe(1);
      expect(payload.acceptanceRate).toBe(1.0);
      expect(payload.totalCharsGenerated).toBe(38);
      expect(payload.languages.typescript.requests).toBe(1);
      expect(payload.errorCounts.network).toBe(1);

      // Verify that no raw code text appears anywhere in the JSON representation
      const json = exporter.formatJson(payload);
      expect(json).not.toContain("sensitiveUserSecretCode");
      expect(json).not.toContain("12345");
    });

    it("should block export when local-only mode is active", async () => {
      const tracker = new CompletionMetricsTracker();
      const summary = tracker.getSummary();
      const metadata = {
        sessionId: "sess-1",
        provider: "custom",
        model: "qwen-coder",
        localOnly: true,
      };

      let sinkCalled = false;
      const res = await exporter.export(
        summary,
        metadata,
        { enabled: true, localOnly: true },
        async () => {
          sinkCalled = true;
        }
      );

      expect(res.transmitted).toBe(false);
      expect(res.reason).toBe("local_only_mode_enabled");
      expect(sinkCalled).toBe(false);
    });

    it("should block export when telemetry is disabled", async () => {
      const tracker = new CompletionMetricsTracker();
      const summary = tracker.getSummary();
      const metadata = {
        sessionId: "sess-1",
        provider: "custom",
        model: "qwen-coder",
        localOnly: false,
      };

      let sinkCalled = false;
      const res = await exporter.export(
        summary,
        metadata,
        { enabled: false, localOnly: false },
        async () => {
          sinkCalled = true;
        }
      );

      expect(res.transmitted).toBe(false);
      expect(res.reason).toBe("telemetry_disabled");
      expect(sinkCalled).toBe(false);
    });

    it("should dispatch to sink when enabled and not local-only", async () => {
      const tracker = new CompletionMetricsTracker();
      const summary = tracker.getSummary();
      const metadata = {
        sessionId: "sess-1",
        provider: "openai",
        model: "gpt-4o",
        localOnly: false,
      };

      let dispatchedPayload: unknown = null;
      const res = await exporter.export(
        summary,
        metadata,
        { enabled: true, localOnly: false },
        async (payload) => {
          dispatchedPayload = payload;
        }
      );

      expect(res.transmitted).toBe(true);
      expect(dispatchedPayload).not.toBeNull();
    });
  });
});
