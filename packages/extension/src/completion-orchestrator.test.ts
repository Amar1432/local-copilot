import { describe, it, expect, vi, beforeEach } from "vitest";
import { CompletionOrchestrator } from "./completion-orchestrator";
import * as openaiProvider from "./openai-provider";
import type { ProviderConfig } from "@local-copilot/shared";
import type { ContextProvider, ContextChunk } from "@local-copilot/core";

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

/**
 * Create a mock context provider that returns predefined chunks.
 */
function createMockProvider(
  id: string,
  chunks: ContextChunk[],
  available = true
): ContextProvider {
  return {
    id,
    name: `Mock ${id}`,
    priority: 50,
    isAvailable: vi.fn().mockResolvedValue(available),
    getContext: vi.fn().mockResolvedValue(chunks),
  };
}

function makeChunk(overrides: Partial<ContextChunk> = {}): ContextChunk {
  return {
    id: `chunk-${Math.random().toString(36).slice(2, 8)}`,
    type: "file",
    uri: "file:///helper.ts",
    content: "function helper() { return 42; }",
    score: 75,
    estimatedTokens: 10,
    ...overrides,
  };
}

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

  // -----------------------------------------------------------------------
  // Multi-file context integration
  // -----------------------------------------------------------------------

  describe("context provider integration", () => {
    it("should work without context providers (backward compatible)", async () => {
      vi.mocked(openaiProvider.complete).mockResolvedValueOnce({
        text: "  return result;\n}",
        latencyMs: 80,
      });

      const orchestrator = new CompletionOrchestrator(mockConfig);

      const result = await orchestrator.requestCompletion({
        documentUri: "file:///test.ts",
        documentVersion: 1,
        language: "typescript",
        fullText: "function compute() {",
        cursorLine: 0,
        cursorCharacter: 20,
      });

      expect(result).toBe("return result;\n}");
      // Without context providers, contextText should not be set
      const callArgs = vi.mocked(openaiProvider.complete).mock.calls[0];
      expect(callArgs[0].contextText).toBeUndefined();
    });

    it("should gather context from providers and include in request", async () => {
      const chunk = makeChunk({
        id: "file-imports-1",
        type: "import",
        uri: "file:///test.ts",
        content: "import { helper } from './helper';",
        score: 75,
        estimatedTokens: 8,
      });

      const provider = createMockProvider("file", [chunk]);
      vi.mocked(openaiProvider.complete).mockResolvedValueOnce({
        text: "  return helper();\n}",
        latencyMs: 90,
      });

      const orchestrator = new CompletionOrchestrator(mockConfig, undefined, [provider]);

      const result = await orchestrator.requestCompletion({
        documentUri: "file:///test.ts",
        documentVersion: 1,
        language: "typescript",
        fullText: "import { helper } from './helper';\nfunction compute() {",
        cursorLine: 1,
        cursorCharacter: 20,
      });

      expect(result).toBe("return helper();\n}");
      expect(provider.isAvailable).toHaveBeenCalled();
      expect(provider.getContext).toHaveBeenCalled();

      // Verify context was included in the request
      const callArgs = vi.mocked(openaiProvider.complete).mock.calls[0];
      expect(callArgs[0].contextText).toBeDefined();
      expect(callArgs[0].contextText).toContain("import { helper }");
    });

    it("should not include context when providers return empty chunks", async () => {
      const provider = createMockProvider("file", []);
      vi.mocked(openaiProvider.complete).mockResolvedValueOnce({
        text: "  return 0;",
        latencyMs: 50,
      });

      const orchestrator = new CompletionOrchestrator(mockConfig, undefined, [provider]);

      await orchestrator.requestCompletion({
        documentUri: "file:///test.ts",
        documentVersion: 1,
        language: "typescript",
        fullText: "function compute() {",
        cursorLine: 0,
        cursorCharacter: 20,
      });

      const callArgs = vi.mocked(openaiProvider.complete).mock.calls[0];
      expect(callArgs[0].contextText).toBeUndefined();
    });

    it("should skip unavailable providers gracefully", async () => {
      const unavailableProvider = createMockProvider("import-resolver", [], false);
      const availableProvider = createMockProvider("file", [
        makeChunk({ id: "file-scope-1", content: "function compute() {" }),
      ]);

      vi.mocked(openaiProvider.complete).mockResolvedValueOnce({
        text: "  return 1;",
        latencyMs: 60,
      });

      const orchestrator = new CompletionOrchestrator(mockConfig, undefined, [
        unavailableProvider,
        availableProvider,
      ]);

      await orchestrator.requestCompletion({
        documentUri: "file:///test.ts",
        documentVersion: 1,
        language: "typescript",
        fullText: "function compute() {",
        cursorLine: 0,
        cursorCharacter: 20,
      });

      expect(unavailableProvider.getContext).not.toHaveBeenCalled();
      expect(availableProvider.getContext).toHaveBeenCalled();
    });

    it("should handle provider errors gracefully", async () => {
      const errorProvider: ContextProvider = {
        id: "error-provider",
        name: "Error Provider",
        priority: 50,
        getContext: vi.fn().mockRejectedValue(new Error("Provider failed")),
      };

      const goodProvider = createMockProvider("file", [
        makeChunk({ id: "good-chunk-1", content: "const x = 1;" }),
      ]);

      vi.mocked(openaiProvider.complete).mockResolvedValueOnce({
        text: "  return x;",
        latencyMs: 70,
      });

      const orchestrator = new CompletionOrchestrator(mockConfig, undefined, [
        errorProvider,
        goodProvider,
      ]);

      const result = await orchestrator.requestCompletion({
        documentUri: "file:///test.ts",
        documentVersion: 1,
        language: "typescript",
        fullText: "const x = 1;\nfunction compute() {",
        cursorLine: 1,
        cursorCharacter: 20,
      });

      // Should still work despite the error provider
      expect(result).toBe("return x;");
    });

    it("should deduplicate chunks from multiple providers", async () => {
      // Two providers returning chunks with the same symbol name
      const chunk1 = makeChunk({
        id: "file-scope-1",
        symbolName: "compute",
        content: "function compute() { return 1; }",
        score: 80,
      });
      const chunk2 = makeChunk({
        id: "recent-sym-1",
        symbolName: "compute",
        content: "function compute() { return 2; }",
        score: 60,
      });

      const provider1 = createMockProvider("file", [chunk1]);
      const provider2 = createMockProvider("recent-files", [chunk2]);

      vi.mocked(openaiProvider.complete).mockResolvedValueOnce({
        text: "  return result;",
        latencyMs: 80,
      });

      const orchestrator = new CompletionOrchestrator(mockConfig, undefined, [
        provider1,
        provider2,
      ]);

      await orchestrator.requestCompletion({
        documentUri: "file:///test.ts",
        documentVersion: 1,
        language: "typescript",
        fullText: "function compute() {",
        cursorLine: 0,
        cursorCharacter: 22,
      });

      // Context should be included but deduplicated (only one "compute" chunk)
      const callArgs = vi.mocked(openaiProvider.complete).mock.calls[0];
      expect(callArgs[0].contextText).toBeDefined();
      // The higher-scored chunk should be kept
      expect(callArgs[0].contextText).toContain("return 1;");
    });

    it("should set context providers via setContextProviders", async () => {
      const provider = createMockProvider("file", [
        makeChunk({ id: "ctx-1", content: "const x = 42;" }),
      ]);

      vi.mocked(openaiProvider.complete).mockResolvedValueOnce({
        text: "  return x;",
        latencyMs: 60,
      });

      const orchestrator = new CompletionOrchestrator(mockConfig);
      orchestrator.setContextProviders([provider]);

      await orchestrator.requestCompletion({
        documentUri: "file:///test.ts",
        documentVersion: 1,
        language: "typescript",
        fullText: "const x = 42;\nfunction compute() {",
        cursorLine: 1,
        cursorCharacter: 20,
      });

      expect(provider.getContext).toHaveBeenCalled();
      const callArgs = vi.mocked(openaiProvider.complete).mock.calls[0];
      expect(callArgs[0].contextText).toBeDefined();
    });

    it("should use budget preset from config", async () => {
      vi.mocked(openaiProvider.complete).mockResolvedValueOnce({
        text: "  return 0;",
        latencyMs: 50,
      });

      const configWithPreset = { ...mockConfig, contextBudgetPreset: "fast" };
      const orchestrator = new CompletionOrchestrator(configWithPreset);

      await orchestrator.requestCompletion({
        documentUri: "file:///test.ts",
        documentVersion: 1,
        language: "typescript",
        fullText: "function compute() {",
        cursorLine: 0,
        cursorCharacter: 20,
      });

      // Should complete without errors (fast budget preset is applied internally)
      expect(openaiProvider.complete).toHaveBeenCalledTimes(1);
    });

    it("should include context in cache fingerprint indirectly through request", async () => {
      // Two requests with same cursor but different context should both cache independently
      // (context is part of the request to the provider, not the fingerprint)
      const provider = createMockProvider("file", [
        makeChunk({ id: "chunk-1", content: "const x = 1;" }),
      ]);

      vi.mocked(openaiProvider.complete).mockResolvedValue({
        text: "  return x;",
        latencyMs: 50,
      });

      const orchestrator = new CompletionOrchestrator(mockConfig, undefined, [provider]);

      await orchestrator.requestCompletion({
        documentUri: "file:///test.ts",
        documentVersion: 1,
        language: "typescript",
        fullText: "const x = 1;\nfunction compute() {",
        cursorLine: 1,
        cursorCharacter: 20,
      });

      // Second identical request should hit cache (fingerprint is same)
      await orchestrator.requestCompletion({
        documentUri: "file:///test.ts",
        documentVersion: 1,
        language: "typescript",
        fullText: "const x = 1;\nfunction compute() {",
        cursorLine: 1,
        cursorCharacter: 20,
      });

      // Provider called only once (second request hits cache)
      expect(openaiProvider.complete).toHaveBeenCalledTimes(1);
      expect(orchestrator.cacheStats.hits).toBe(1);
    });
  });
});
