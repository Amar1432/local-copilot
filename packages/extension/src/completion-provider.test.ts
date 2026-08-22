import { describe, it, expect, beforeEach } from "vitest";
import { LocalCopilotCompletionProvider } from "./completion-provider";

describe("LocalCopilotCompletionProvider", () => {
  let provider: LocalCopilotCompletionProvider;

  beforeEach(() => {
    provider = new LocalCopilotCompletionProvider();
  });

  it("should create a completion provider", () => {
    expect(provider).toBeDefined();
  });

  it("should have provideInlineCompletionItems method", () => {
    expect(typeof provider.provideInlineCompletionItems).toBe("function");
  });

  it("should have updateConfig method", () => {
    expect(typeof provider.updateConfig).toBe("function");
  });

  it("should accept config updates without throwing", () => {
    provider.updateConfig({
      enabled: true,
      provider: "custom",
      baseUrl: "http://localhost:11434/v1",
      apiKey: "",
      model: "test-model",
      debounceMs: 100,
      requestTimeoutMs: 1000,
      maxOutputTokens: 64,
      temperature: 0.2,
      contextMaxLines: 50,
      localOnly: true,
      telemetryEnabled: false,
    });
  });
});
