import { describe, it, expect } from "vitest";
import type {
  CompletionProvider,
  ProviderCapabilities,
  ModelCapabilities,
  ModelInfo,
} from "./provider.types";
import { ProviderError } from "./provider.types";
import type {
  CompletionRequest,
  CompletionResponse,
  ProviderConfig,
} from "@local-copilot/shared";

describe("CompletionProvider Interface & Types", () => {
  it("should allow implementing a mock CompletionProvider conforming to the interface", async () => {
    class MockProvider implements CompletionProvider {
      readonly id = "mock-provider";
      readonly capabilities: ProviderCapabilities = {
        streaming: false,
        fim: true,
        stopSequences: true,
        modelListing: true,
        contextWindow: 8192,
        maxOutputTokens: 2048,
        auth: "apiKey",
      };

      async validateConfig(config: ProviderConfig): Promise<void> {
        if (!config.baseUrl) {
          throw new ProviderError({
            code: "invalid_request",
            message: "baseUrl is required",
            retryable: false,
          });
        }
      }

      async getModels(_signal?: AbortSignal): Promise<ModelInfo[]> {
        const modelCaps: ModelCapabilities = {
          streaming: false,
          fim: true,
          stopSequences: true,
          contextWindow: 8192,
          maxOutputTokens: 2048,
          auth: "apiKey",
        };

        return [
          {
            id: "qwen-coder",
            name: "Qwen 2.5 Coder 7B",
            capabilities: modelCaps,
            contextWindow: 8192,
            description: "High quality local code completion model",
          },
        ];
      }

      async complete(
        request: CompletionRequest,
        _signal: AbortSignal
      ): Promise<CompletionResponse | null> {
        return {
          text: `// completion for ${request.language}`,
          latencyMs: 42,
        };
      }
    }

    const provider: CompletionProvider = new MockProvider();
    expect(provider.id).toBe("mock-provider");
    expect(provider.capabilities?.fim).toBe(true);
    expect(provider.capabilities?.auth).toBe("apiKey");

    const mockConfig: ProviderConfig = {
      enabled: true,
      provider: "custom",
      baseUrl: "http://localhost:11434/v1",
      apiKey: "secret",
      model: "qwen-coder",
      debounceMs: 150,
      requestTimeoutMs: 2000,
      maxOutputTokens: 128,
      temperature: 0.1,
      contextMaxLines: 120,
      localOnly: true,
      telemetryEnabled: false,
    };

    await expect(provider.validateConfig(mockConfig)).resolves.toBeUndefined();

    const models = await provider.getModels();
    expect(models).toHaveLength(1);
    expect(models[0].id).toBe("qwen-coder");
    expect(models[0].name).toBe("Qwen 2.5 Coder 7B");
    expect(models[0].capabilities.fim).toBe(true);

    const controller = new AbortController();
    const result = await provider.complete(
      {
        documentUri: "file:///test.ts",
        documentVersion: 1,
        language: "typescript",
        prefix: "const x = ",
        suffix: ";",
        position: { line: 0, character: 10 },
      },
      controller.signal
    );

    expect(result).not.toBeNull();
    expect(result?.text).toBe("// completion for typescript");
    expect(result?.latencyMs).toBe(42);
  });

  describe("ProviderError", () => {
    it("should instantiate with required details and properties", () => {
      const error = new ProviderError({
        code: "authentication",
        message: "Invalid API key provided",
        retryable: false,
        statusCode: 401,
      });

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ProviderError);
      expect(error.name).toBe("ProviderError");
      expect(error.code).toBe("authentication");
      expect(error.message).toBe("Invalid API key provided");
      expect(error.retryable).toBe(false);
      expect(error.statusCode).toBe(401);
    });

    it("should correctly handle cause when provided", () => {
      const underlyingError = new Error("Connection refused");
      const error = new ProviderError({
        code: "network",
        message: "Failed to connect to host",
        retryable: true,
        statusCode: 503,
        cause: underlyingError,
      });

      expect(error.code).toBe("network");
      expect(error.retryable).toBe(true);
      expect(error.cause).toBe(underlyingError);
    });

    it("should support all error codes", () => {
      const errorCodes = [
        "authentication",
        "not_found",
        "timeout",
        "rate_limit",
        "network",
        "invalid_request",
        "unknown",
      ] as const;

      for (const code of errorCodes) {
        const err = new ProviderError({
          code,
          message: `Error code: ${code}`,
          retryable: code === "timeout" || code === "network" || code === "rate_limit",
        });
        expect(err.code).toBe(code);
      }
    });
  });
});
