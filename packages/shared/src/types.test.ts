import { describe, it, expect } from "vitest";
import type {
  ProviderType,
  ConnectionStatus,
  ProviderConfig,
  CompletionRequest,
  CompletionResponse,
  DiagnosticsInfo,
} from "./types";

describe("shared types", () => {
  it("should create a valid ProviderConfig object", () => {
    const config: ProviderConfig = {
      enabled: true,
      provider: "custom",
      baseUrl: "http://localhost:11434/v1",
      apiKey: "",
      model: "qwen-coder",
      debounceMs: 150,
      requestTimeoutMs: 2000,
      maxOutputTokens: 128,
      temperature: 0.1,
      contextMaxLines: 120,
      localOnly: true,
      telemetryEnabled: false,
    };

    expect(config.enabled).toBe(true);
    expect(config.provider).toBe("custom");
    expect(config.baseUrl).toBe("http://localhost:11434/v1");
    expect(config.model).toBe("qwen-coder");
    expect(config.debounceMs).toBe(150);
    expect(config.localOnly).toBe(true);
  });

  it("should accept all valid ProviderType values", () => {
    const types: ProviderType[] = ["custom", "ollama", "openai", "lmstudio", "vllm"];
    expect(types).toHaveLength(5);
    for (const t of types) {
      expect(typeof t).toBe("string");
    }
  });

  it("should accept all valid ConnectionStatus values", () => {
    const statuses: ConnectionStatus[] = ["connected", "disconnected", "checking"];
    expect(statuses).toHaveLength(3);
  });

  it("should create a valid CompletionRequest object", () => {
    const request: CompletionRequest = {
      documentUri: "file:///test.ts",
      documentVersion: 1,
      language: "typescript",
      prefix: "function hello() {\n  ",
      suffix: "\n}",
      position: { line: 1, character: 2 },
    };

    expect(request.documentUri).toBe("file:///test.ts");
    expect(request.language).toBe("typescript");
    expect(request.position.line).toBe(1);
  });

  it("should create a valid CompletionResponse object", () => {
    const response: CompletionResponse = {
      text: 'console.log("hello");',
      latencyMs: 120,
    };

    expect(response.text).toContain("console.log");
    expect(response.latencyMs).toBeGreaterThan(0);
  });

  it("should create a valid DiagnosticsInfo object", () => {
    const info: DiagnosticsInfo = {
      provider: "ollama",
      model: "qwen-coder",
      status: "connected",
      latencyMs: 182,
      lastRequestStatus: "success",
      lastRequestTokens: 48,
      cacheHits: 21,
      cacheMisses: 47,
      totalRequests: 68,
    };

    expect(info.provider).toBe("ollama");
    expect(info.cacheHits + info.cacheMisses).toBe(info.totalRequests);
  });
});
