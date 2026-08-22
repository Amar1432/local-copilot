import { describe, it, expect, vi, beforeEach } from "vitest";
import { CompletionOrchestrator } from "./completion-orchestrator";
import * as openaiProvider from "./openai-provider";
import type { ProviderConfig } from "@local-copilot/shared";

vi.mock("./openai-provider", () => ({
  complete: vi.fn(),
  testConnection: vi.fn(),
}));

const mockConfig: ProviderConfig = {
  enabled: true,
  provider: "custom",
  baseUrl: "http://localhost:11434/v1",
  apiKey: "",
  model: "qwen-coder",
  debounceMs: 10,
  requestTimeoutMs: 2000,
  maxOutputTokens: 128,
  temperature: 0.1,
  contextMaxLines: 120,
  localOnly: true,
  telemetryEnabled: false,
};

describe("CompletionOrchestrator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return null if extension is disabled", async () => {
    const orchestrator = new CompletionOrchestrator({
      ...mockConfig,
      enabled: false,
    });

    const result = await orchestrator.requestCompletion({
      documentUri: "file:///test.ts",
      documentVersion: 1,
      language: "typescript",
      fullText: "function add(a: number, b: number) {",
      cursorLine: 0,
      cursorCharacter: 36,
    });

    expect(result).toBeNull();
    expect(openaiProvider.complete).not.toHaveBeenCalled();
  });

  it("should return null if model is not configured", async () => {
    const orchestrator = new CompletionOrchestrator({
      ...mockConfig,
      model: "",
    });

    const result = await orchestrator.requestCompletion({
      documentUri: "file:///test.ts",
      documentVersion: 1,
      language: "typescript",
      fullText: "function add(a: number, b: number) {",
      cursorLine: 0,
      cursorCharacter: 36,
    });

    expect(result).toBeNull();
    expect(openaiProvider.complete).not.toHaveBeenCalled();
  });

  it("should return null if cancelled before execution", async () => {
    const orchestrator = new CompletionOrchestrator(mockConfig);

    const result = await orchestrator.requestCompletion({
      documentUri: "file:///test.ts",
      documentVersion: 1,
      language: "typescript",
      fullText: "function add(a: number, b: number) {",
      cursorLine: 0,
      cursorCharacter: 36,
      cancellationToken: { isCancellationRequested: true },
    });

    expect(result).toBeNull();
    expect(openaiProvider.complete).not.toHaveBeenCalled();
  });

  it("should call provider, normalize output, and cache result", async () => {
    vi.mocked(openaiProvider.complete).mockResolvedValueOnce({
      text: "  return a + b;\n}",
      latencyMs: 120,
    });

    const orchestrator = new CompletionOrchestrator(mockConfig);

    const result = await orchestrator.requestCompletion({
      documentUri: "file:///test.ts",
      documentVersion: 1,
      language: "typescript",
      fullText: "function add(a: number, b: number) {",
      cursorLine: 0,
      cursorCharacter: 36,
    });

    expect(result).toBe("return a + b;\n}");
    expect(openaiProvider.complete).toHaveBeenCalledTimes(1);
    expect(orchestrator.latencyMs).toBe(120);
    expect(orchestrator.cacheStats.hits).toBe(0);
    expect(orchestrator.cacheStats.misses).toBe(1);
    expect(orchestrator.cacheStats.size).toBe(1);

    // Second request with same document state should hit cache
    const cachedResult = await orchestrator.requestCompletion({
      documentUri: "file:///test.ts",
      documentVersion: 1,
      language: "typescript",
      fullText: "function add(a: number, b: number) {",
      cursorLine: 0,
      cursorCharacter: 36,
    });

    expect(cachedResult).toBe("return a + b;\n}");
    expect(openaiProvider.complete).toHaveBeenCalledTimes(1); // Not called again
    expect(orchestrator.cacheStats.hits).toBe(1);
  });

  it("should support clearing the cache", async () => {
    vi.mocked(openaiProvider.complete).mockResolvedValue({
      text: "  return a + b;\n}",
      latencyMs: 100,
    });

    const orchestrator = new CompletionOrchestrator(mockConfig);

    await orchestrator.requestCompletion({
      documentUri: "file:///test.ts",
      documentVersion: 1,
      language: "typescript",
      fullText: "function add(a: number, b: number) {",
      cursorLine: 0,
      cursorCharacter: 36,
    });

    expect(orchestrator.cacheStats.size).toBe(1);

    orchestrator.clearCache();
    expect(orchestrator.cacheStats.size).toBe(0);

    // After clearing cache, calling again invokes provider
    await orchestrator.requestCompletion({
      documentUri: "file:///test.ts",
      documentVersion: 1,
      language: "typescript",
      fullText: "function add(a: number, b: number) {",
      cursorLine: 0,
      cursorCharacter: 36,
    });

    expect(openaiProvider.complete).toHaveBeenCalledTimes(2);
  });

  it("should update connection state on testProviderConnection", async () => {
    vi.mocked(openaiProvider.testConnection).mockResolvedValueOnce(true);

    const orchestrator = new CompletionOrchestrator(mockConfig);
    expect(orchestrator.connectionState).toBe("idle");

    const connected = await orchestrator.testProviderConnection();
    expect(connected).toBe(true);
    expect(orchestrator.connectionState).toBe("connected");

    vi.mocked(openaiProvider.testConnection).mockResolvedValueOnce(false);
    const disconnected = await orchestrator.testProviderConnection();
    expect(disconnected).toBe(false);
    expect(orchestrator.connectionState).toBe("disconnected");
  });
});
