import { describe, it, expect, vi } from "vitest";
import { OpenAICompatibleProvider } from "./openai-compatible-provider";
import { ProviderError } from "./provider.types";
import type { CompletionRequest, ProviderConfig } from "@private-copilot/shared";

function createMockConfig(overrides?: Partial<ProviderConfig>): ProviderConfig {
  return {
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
    ...overrides,
  };
}

function createMockRequest(overrides?: Partial<CompletionRequest>): CompletionRequest {
  return {
    documentUri: "file:///workspace/test.ts",
    documentVersion: 1,
    language: "typescript",
    prefix: "function multiply(a: number, b: number): number {\n  return ",
    suffix: "\n}",
    position: { line: 1, character: 9 },
    ...overrides,
  };
}

describe("OpenAICompatibleProvider", () => {
  it("should initialize with custom ID and default capabilities", () => {
    const provider = new OpenAICompatibleProvider({ id: "ollama" });
    expect(provider.id).toBe("ollama");
    expect(provider.capabilities.streaming).toBe(true);
    expect(provider.capabilities.fim).toBe(true);
    expect(provider.capabilities.modelListing).toBe(true);
  });

  describe("validateConfig", () => {
    it("should accept valid HTTP/HTTPS URLs", async () => {
      const provider = new OpenAICompatibleProvider();
      await expect(
        provider.validateConfig(createMockConfig({ baseUrl: "http://localhost:11434/v1" }))
      ).resolves.toBeUndefined();

      await expect(
        provider.validateConfig(
          createMockConfig({
            baseUrl: "https://api.openai.com/v1",
            localOnly: false,
          })
        )
      ).resolves.toBeUndefined();
    });

    it("should reject remote URLs when localOnly is enabled", async () => {
      const provider = new OpenAICompatibleProvider();
      await expect(
        provider.validateConfig(
          createMockConfig({
            baseUrl: "https://api.openai.com/v1",
            localOnly: true,
          })
        )
      ).rejects.toThrow(ProviderError);
    });

    it("should reject empty or invalid baseUrl", async () => {
      const provider = new OpenAICompatibleProvider();
      await expect(
        provider.validateConfig(createMockConfig({ baseUrl: "" }))
      ).rejects.toThrow(ProviderError);

      await expect(
        provider.validateConfig(createMockConfig({ baseUrl: "ftp://invalid-url" }))
      ).rejects.toThrow(ProviderError);
    });
  });

  describe("getModels", () => {
    it("should fetch and parse models from GET /models with auth header", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            { id: "qwen-coder:7b", name: "Qwen 2.5 Coder 7B" },
            { id: "deepseek-coder:6.7b", name: "DeepSeek Coder" },
          ],
        }),
      } as unknown as Response);

      const config = createMockConfig({
        baseUrl: "http://localhost:11434/v1",
        apiKey: "test-api-key",
      });

      const provider = new OpenAICompatibleProvider({
        config,
        customFetch: mockFetch as unknown as typeof fetch,
      });

      const models = await provider.getModels();
      expect(models).toHaveLength(2);
      expect(models[0].id).toBe("qwen-coder:7b");
      expect(models[0].name).toBe("Qwen 2.5 Coder 7B");
      expect(models[0].capabilities.auth).toBe("apiKey");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:11434/v1/models",
        expect.objectContaining({
          method: "GET",
          headers: {
            Accept: "application/json",
            Authorization: "Bearer test-api-key",
          },
        })
      );
    });

    it("should handle raw array response format for models", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [{ id: "model-1" }, { id: "model-2" }],
      } as unknown as Response);

      const provider = new OpenAICompatibleProvider({
        config: createMockConfig(),
        customFetch: mockFetch as unknown as typeof fetch,
      });

      const models = await provider.getModels();
      expect(models).toHaveLength(2);
      expect(models[0].id).toBe("model-1");
    });
  });

  describe("complete (non-streaming)", () => {
    it("should send completion request and parse content from message", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: "chatcmpl-123",
          choices: [
            {
              message: { content: "a * b;" },
              finish_reason: "stop",
            },
          ],
        }),
      } as unknown as Response);

      const config = createMockConfig({
        baseUrl: "http://localhost:11434/v1",
        apiKey: "sk-secret",
        model: "qwen-coder",
      });

      const provider = new OpenAICompatibleProvider({
        config,
        customFetch: mockFetch as unknown as typeof fetch,
      });

      const controller = new AbortController();
      const request = createMockRequest();

      const result = await provider.complete(request, controller.signal);
      expect(result).not.toBeNull();
      expect(result?.text).toBe("a * b;");
      expect(result?.latencyMs).toBeGreaterThanOrEqual(0);

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:11434/v1/chat/completions",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer sk-secret",
          },
        })
      );
    });

    it("should parse legacy choices[0].text format", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ text: "return a + b;" }],
        }),
      } as unknown as Response);

      const provider = new OpenAICompatibleProvider({
        config: createMockConfig(),
        customFetch: mockFetch as unknown as typeof fetch,
      });

      const controller = new AbortController();
      const result = await provider.complete(createMockRequest(), controller.signal);
      expect(result?.text).toBe("return a + b;");
    });

    it("should format request with FIM tokens when model supports FIM", async () => {
      let capturedBody: { messages?: Array<{ role: string; content: string }> } = {};
      const mockFetch = vi.fn().mockImplementation(async (_url, opts) => {
        capturedBody = JSON.parse(opts.body);
        return {
          ok: true,
          json: async () => ({
            choices: [{ message: { content: "a * b;" } }],
          }),
        } as Response;
      });

      const provider = new OpenAICompatibleProvider({
        config: createMockConfig({ model: "qwen-2.5-coder:7b" }),
        customFetch: mockFetch as unknown as typeof fetch,
      });

      const controller = new AbortController();
      const request = createMockRequest({
        prefix: "const x = ",
        suffix: ";",
      });

      const result = await provider.complete(request, controller.signal);
      expect(result?.text).toBe("a * b;");
      expect(capturedBody.messages).toHaveLength(1);
      expect(capturedBody.messages?.[0].content).toContain("<|fim_prefix|>const x = ");
      expect(capturedBody.messages?.[0].content).toContain("<|fim_suffix|>;");
      expect(capturedBody.messages?.[0].content).toContain("<|fim_middle|>");
    });

    it("should fall back to standard prompt when FIM is unsupported or disabled", async () => {
      let capturedBody: { messages?: Array<{ role: string; content: string }> } = {};
      const mockFetch = vi.fn().mockImplementation(async (_url, opts) => {
        capturedBody = JSON.parse(opts.body);
        return {
          ok: true,
          json: async () => ({
            choices: [{ message: { content: "return x;" } }],
          }),
        } as Response;
      });

      const provider = new OpenAICompatibleProvider({
        config: createMockConfig({ model: "gpt-4o", useFim: false }),
        customFetch: mockFetch as unknown as typeof fetch,
      });

      const controller = new AbortController();
      const request = createMockRequest({
        prefix: "function test() {\n  ",
        suffix: "\n}",
      });

      const result = await provider.complete(request, controller.signal);
      expect(result?.text).toBe("return x;");
      expect(capturedBody.messages).toHaveLength(2);
      expect(capturedBody.messages?.[0].role).toBe("system");
      expect(capturedBody.messages?.[1].content).toContain("<PREFIX>");
      expect(capturedBody.messages?.[1].content).toContain("<SUFFIX>");
    });

    it("should return null if model is not set", async () => {
      const provider = new OpenAICompatibleProvider({
        config: createMockConfig({ model: "" }),
      });

      const controller = new AbortController();
      const result = await provider.complete(createMockRequest(), controller.signal);
      expect(result).toBeNull();
    });

    it("should return null if request is aborted", async () => {
      const mockFetch = vi.fn().mockImplementation(() => {
        throw new DOMException("The operation was aborted", "AbortError");
      });

      const provider = new OpenAICompatibleProvider({
        config: createMockConfig(),
        customFetch: mockFetch as unknown as typeof fetch,
      });

      const controller = new AbortController();
      controller.abort();

      const result = await provider.complete(createMockRequest(), controller.signal);
      expect(result).toBeNull();
    });
  });

  describe("completeStream (streaming SSE)", () => {
    it("should yield tokens incrementally from Server-Sent Events", async () => {
      const sseChunks = [
        'data: {"choices":[{"delta":{"content":"a"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":" * "}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"b;"}}]}\n\n',
        "data: [DONE]\n\n",
      ];

      const encoder = new TextEncoder();
      let chunkIdx = 0;
      const stream = new ReadableStream({
        pull(controller) {
          if (chunkIdx < sseChunks.length) {
            controller.enqueue(encoder.encode(sseChunks[chunkIdx++]));
          } else {
            controller.close();
          }
        },
      });

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        body: stream,
      } as unknown as Response);

      const provider = new OpenAICompatibleProvider({
        config: createMockConfig({ apiKey: "stream-key" }),
        customFetch: mockFetch as unknown as typeof fetch,
      });

      const controller = new AbortController();
      const tokens: string[] = [];

      for await (const token of provider.completeStream(
        createMockRequest(),
        controller.signal
      )) {
        tokens.push(token);
      }

      expect(tokens).toEqual(["a", " * ", "b;"]);
    });
  });

  describe("error handling", () => {
    it("should classify 401 as authentication error", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => "Unauthorized: Invalid API key",
      } as unknown as Response);

      const provider = new OpenAICompatibleProvider({
        config: createMockConfig(),
        customFetch: mockFetch as unknown as typeof fetch,
      });

      const controller = new AbortController();
      await expect(
        provider.complete(createMockRequest(), controller.signal)
      ).rejects.toThrow(ProviderError);

      try {
        await provider.complete(createMockRequest(), controller.signal);
      } catch (err) {
        expect((err as ProviderError).code).toBe("authentication");
        expect((err as ProviderError).statusCode).toBe(401);
        expect((err as ProviderError).retryable).toBe(false);
      }
    });

    it("should classify 404 as not_found error", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => "Model not found",
      } as unknown as Response);

      const provider = new OpenAICompatibleProvider({
        config: createMockConfig(),
        customFetch: mockFetch as unknown as typeof fetch,
      });

      const controller = new AbortController();
      try {
        await provider.complete(createMockRequest(), controller.signal);
      } catch (err) {
        expect((err as ProviderError).code).toBe("not_found");
        expect((err as ProviderError).statusCode).toBe(404);
      }
    });

    it("should classify 429 as rate_limit error (retryable)", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => "Too Many Requests",
      } as unknown as Response);

      const provider = new OpenAICompatibleProvider({
        config: createMockConfig(),
        customFetch: mockFetch as unknown as typeof fetch,
      });

      const controller = new AbortController();
      try {
        await provider.complete(createMockRequest(), controller.signal);
      } catch (err) {
        expect((err as ProviderError).code).toBe("rate_limit");
        expect((err as ProviderError).retryable).toBe(true);
      }
    });

    it("should classify 500 as network error (retryable)", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => "Internal Server Error",
      } as unknown as Response);

      const provider = new OpenAICompatibleProvider({
        config: createMockConfig(),
        customFetch: mockFetch as unknown as typeof fetch,
      });

      const controller = new AbortController();
      try {
        await provider.complete(createMockRequest(), controller.signal);
      } catch (err) {
        expect((err as ProviderError).code).toBe("network");
        expect((err as ProviderError).retryable).toBe(true);
      }
    });
  });
});
