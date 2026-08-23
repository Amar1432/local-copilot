import { describe, it, expect, vi } from "vitest";
import { ProviderRouter } from "./provider-router";
import type { CompletionProvider, ModelInfo } from "./provider.types";
import { ProviderError } from "./provider.types";
import type {
  CompletionRequest,
  CompletionResponse,
  ProviderConfig,
} from "@private-copilot/shared";

function createMockProvider(id: string): CompletionProvider {
  return {
    id,
    capabilities: {
      streaming: false,
      fim: true,
      stopSequences: true,
      modelListing: true,
      auth: "none",
    },
    validateConfig: vi.fn().mockResolvedValue(undefined),
    getModels: vi.fn().mockResolvedValue([
      {
        id: `${id}-model`,
        name: `${id} model`,
        capabilities: {
          streaming: false,
          fim: true,
          stopSequences: true,
          contextWindow: 4096,
          auth: "none",
        },
      },
    ] as ModelInfo[]),
    complete: vi.fn().mockImplementation(async (req: CompletionRequest) => {
      return {
        text: `// completion from ${id} for ${req.language}`,
        latencyMs: 15,
      } as CompletionResponse;
    }),
  };
}

function createConfig(overrides?: Partial<ProviderConfig>): ProviderConfig {
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

describe("ProviderRouter", () => {
  it("should initialize with provided providers and default provider", () => {
    const provider1 = createMockProvider("ollama");
    const provider2 = createMockProvider("openai");

    const router = new ProviderRouter({
      providers: [provider1, provider2],
      defaultProviderId: "ollama",
    });

    expect(router.hasProvider("ollama")).toBe(true);
    expect(router.hasProvider("openai")).toBe(true);
    expect(router.hasProvider("custom")).toBe(false);
    expect(router.currentProviderId).toBe("ollama");
    expect(router.getRegisteredProviderIds()).toEqual(["ollama", "openai"]);
  });

  it("should register and unregister providers dynamically", () => {
    const router = new ProviderRouter();
    const mock = createMockProvider("lmstudio");

    expect(router.hasProvider("lmstudio")).toBe(false);
    router.registerProvider(mock);
    expect(router.hasProvider("lmstudio")).toBe(true);
    expect(router.getProvider("lmstudio")).toBe(mock);

    const unregistered = router.unregisterProvider("lmstudio");
    expect(unregistered).toBe(true);
    expect(router.hasProvider("lmstudio")).toBe(false);
  });

  it("should reject registering provider with invalid ID", () => {
    const router = new ProviderRouter();
    expect(() =>
      router.registerProvider({} as unknown as CompletionProvider)
    ).toThrow(ProviderError);
  });

  it("should select the configured provider and support switching", () => {
    const ollama = createMockProvider("ollama");
    const openai = createMockProvider("openai");
    const router = new ProviderRouter({ providers: [ollama, openai] });

    const configOllama = createConfig({ provider: "ollama" });
    const selected1 = router.selectProvider(configOllama);
    expect(selected1.id).toBe("ollama");
    expect(router.currentProviderId).toBe("ollama");

    const configOpenAI = createConfig({
      provider: "openai",
      baseUrl: "https://api.openai.com/v1",
      localOnly: false,
    });
    const selected2 = router.selectProvider(configOpenAI);
    expect(selected2.id).toBe("openai");
    expect(router.currentProviderId).toBe("openai");
  });

  it("should throw ProviderError when selecting an unregistered provider", () => {
    const router = new ProviderRouter();
    const config = createConfig({ provider: "vllm" });

    expect(() => router.selectProvider(config)).toThrow(ProviderError);
    try {
      router.selectProvider(config);
    } catch (err) {
      expect(err).toBeInstanceOf(ProviderError);
      expect((err as ProviderError).code).toBe("not_found");
    }
  });

  describe("validateConfig", () => {
    it("should reject configuration without baseUrl", async () => {
      const router = new ProviderRouter({
        providers: [createMockProvider("custom")],
      });
      const invalidConfig = createConfig({ baseUrl: "" });

      await expect(router.validateConfig(invalidConfig)).rejects.toThrow(
        "baseUrl is required"
      );
    });

    it("should reject remote baseUrl when localOnly is true", async () => {
      const router = new ProviderRouter({
        providers: [createMockProvider("openai")],
      });
      const remoteConfig = createConfig({
        provider: "openai",
        baseUrl: "https://api.openai.com/v1",
        localOnly: true,
      });

      await expect(router.validateConfig(remoteConfig)).rejects.toThrow(
        /Local-only mode is enabled/
      );
    });

    it("should accept localhost/127.0.0.1 when localOnly is true", async () => {
      const provider = createMockProvider("custom");
      const router = new ProviderRouter({ providers: [provider] });

      const localConfig1 = createConfig({
        baseUrl: "http://localhost:11434/v1",
        localOnly: true,
      });
      await expect(
        router.validateConfig(localConfig1)
      ).resolves.toBeUndefined();

      const localConfig2 = createConfig({
        baseUrl: "http://127.0.0.1:1234/v1",
        localOnly: true,
      });
      await expect(
        router.validateConfig(localConfig2)
      ).resolves.toBeUndefined();

      expect(provider.validateConfig).toHaveBeenCalledTimes(2);
    });
  });

  describe("complete", () => {
    it("should route completion request to selected provider", async () => {
      const ollama = createMockProvider("ollama");
      const router = new ProviderRouter({ providers: [ollama] });
      const config = createConfig({ provider: "ollama" });
      const controller = new AbortController();

      const request: CompletionRequest = {
        documentUri: "file:///test.ts",
        documentVersion: 1,
        language: "typescript",
        prefix: "function add(",
        suffix: ") {}",
        position: { line: 0, character: 13 },
      };

      const result = await router.complete(request, config, controller.signal);
      expect(result).not.toBeNull();
      expect(result?.text).toBe("// completion from ollama for typescript");
      expect(ollama.complete).toHaveBeenCalledWith(request, controller.signal);
    });

    it("should return null if request is aborted", async () => {
      const provider = createMockProvider("custom");
      (provider.complete as ReturnType<typeof vi.fn>).mockImplementation(
        async () => {
          throw new DOMException("The operation was aborted", "AbortError");
        }
      );

      const router = new ProviderRouter({ providers: [provider] });
      const config = createConfig({ provider: "custom" });
      const controller = new AbortController();
      controller.abort();

      const request: CompletionRequest = {
        documentUri: "file:///test.ts",
        documentVersion: 1,
        language: "typescript",
        prefix: "const a = ",
        suffix: ";",
        position: { line: 0, character: 10 },
      };

      const result = await router.complete(request, config, controller.signal);
      expect(result).toBeNull();
    });

    it("should wrap non-ProviderError exceptions into ProviderError", async () => {
      const provider = createMockProvider("custom");
      (provider.complete as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Network timeout")
      );

      const router = new ProviderRouter({ providers: [provider] });
      const config = createConfig({ provider: "custom" });
      const controller = new AbortController();

      const request: CompletionRequest = {
        documentUri: "file:///test.ts",
        documentVersion: 1,
        language: "typescript",
        prefix: "let x = ",
        suffix: ";",
        position: { line: 0, character: 8 },
      };

      await expect(
        router.complete(request, config, controller.signal)
      ).rejects.toThrow(ProviderError);
    });
  });

  describe("getModels", () => {
    it("should route getModels to the configured provider", async () => {
      const lmstudio = createMockProvider("lmstudio");
      const router = new ProviderRouter({ providers: [lmstudio] });
      const config = createConfig({ provider: "lmstudio" });

      const models = await router.getModels(config);
      expect(models).toHaveLength(1);
      expect(models[0].id).toBe("lmstudio-model");
      expect(lmstudio.getModels).toHaveBeenCalled();
    });
  });
});
