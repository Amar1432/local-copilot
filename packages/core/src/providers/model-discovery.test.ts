import { describe, it, expect, vi } from "vitest";
import { ModelDiscoveryService } from "./model-discovery";
import { ProviderRouter } from "./provider-router";
import type { CompletionProvider, ModelInfo } from "./provider.types";
import type { ProviderConfig } from "@private-copilot/shared";

function createConfig(overrides?: Partial<ProviderConfig>): ProviderConfig {
  return {
    enabled: true,
    provider: "custom",
    baseUrl: "http://localhost:11434/v1",
    apiKey: "test-key",
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

describe("ModelDiscoveryService", () => {
  it("should discover models via ProviderRouter and enrich capabilities", async () => {
    const mockProvider: CompletionProvider = {
      id: "custom",
      validateConfig: vi.fn().mockResolvedValue(undefined),
      getModels: vi.fn().mockResolvedValue([
        { id: "qwen-2.5-coder:7b", name: "Qwen 2.5 Coder" },
        { id: "gpt-4o", name: "GPT-4o" },
      ] as ModelInfo[]),
      complete: vi.fn(),
    };

    const router = new ProviderRouter({ providers: [mockProvider] });
    const discovery = new ModelDiscoveryService({ router });
    const config = createConfig();

    const models = await discovery.discoverModels(config);
    expect(models).toHaveLength(2);

    expect(models[0].id).toBe("qwen-2.5-coder:7b");
    expect(models[0].capabilities.fim).toBe(true);
    expect(models[0].capabilities.contextWindow).toBe(8192);
    expect(models[0].capabilities.auth).toBe("apiKey");

    expect(models[1].id).toBe("gpt-4o");
    expect(models[1].capabilities.fim).toBe(false);

    expect(mockProvider.getModels).toHaveBeenCalledTimes(1);
  });

  it("should cache discovered models and serve cache on subsequent calls", async () => {
    const getModelsSpy = vi.fn().mockResolvedValue([
      { id: "starcoder2:3b", name: "StarCoder 2" },
    ] as ModelInfo[]);

    const mockProvider: CompletionProvider = {
      id: "custom",
      validateConfig: vi.fn().mockResolvedValue(undefined),
      getModels: getModelsSpy,
      complete: vi.fn(),
    };

    const router = new ProviderRouter({ providers: [mockProvider] });
    const discovery = new ModelDiscoveryService({ router });
    const config = createConfig();

    const first = await discovery.discoverModels(config);
    const second = await discovery.discoverModels(config);

    expect(first).toEqual(second);
    expect(getModelsSpy).toHaveBeenCalledTimes(1);
  });

  it("should bypass cache when forceRefresh is true", async () => {
    const getModelsSpy = vi.fn().mockResolvedValue([
      { id: "model-1", name: "Model 1" },
    ] as ModelInfo[]);

    const mockProvider: CompletionProvider = {
      id: "custom",
      validateConfig: vi.fn().mockResolvedValue(undefined),
      getModels: getModelsSpy,
      complete: vi.fn(),
    };

    const router = new ProviderRouter({ providers: [mockProvider] });
    const discovery = new ModelDiscoveryService({ router });
    const config = createConfig();

    await discovery.discoverModels(config);
    await discovery.discoverModels(config, { forceRefresh: true });

    expect(getModelsSpy).toHaveBeenCalledTimes(2);
  });

  it("should expire cache entries after configured TTL", async () => {
    const getModelsSpy = vi.fn().mockResolvedValue([
      { id: "model-1", name: "Model 1" },
    ] as ModelInfo[]);

    const mockProvider: CompletionProvider = {
      id: "custom",
      validateConfig: vi.fn().mockResolvedValue(undefined),
      getModels: getModelsSpy,
      complete: vi.fn(),
    };

    const router = new ProviderRouter({ providers: [mockProvider] });
    const discovery = new ModelDiscoveryService({ router, ttlMs: 10 });
    const config = createConfig();

    await discovery.discoverModels(config);
    expect(getModelsSpy).toHaveBeenCalledTimes(1);

    // Wait for TTL expiration
    await new Promise((r) => setTimeout(r, 20));

    await discovery.discoverModels(config);
    expect(getModelsSpy).toHaveBeenCalledTimes(2);
  });

  it("should fallback gracefully when discovery fails", async () => {
    const mockProvider: CompletionProvider = {
      id: "custom",
      validateConfig: vi.fn().mockResolvedValue(undefined),
      getModels: vi.fn().mockRejectedValue(new Error("Endpoint unreachable")),
      complete: vi.fn(),
    };

    const router = new ProviderRouter({ providers: [mockProvider] });
    const discovery = new ModelDiscoveryService({ router });
    const config = createConfig({ model: "deepseek-coder:6.7b" });

    const models = await discovery.discoverModels(config);
    expect(models).toHaveLength(1);
    expect(models[0].id).toBe("deepseek-coder:6.7b");
    expect(models[0].capabilities.fim).toBe(true);
    expect(models[0].description).toBe("Manually configured model");
  });

  it("should clear cached entries on clearCache()", async () => {
    const getModelsSpy = vi.fn().mockResolvedValue([
      { id: "m1", name: "M1" },
    ] as ModelInfo[]);

    const mockProvider: CompletionProvider = {
      id: "custom",
      validateConfig: vi.fn().mockResolvedValue(undefined),
      getModels: getModelsSpy,
      complete: vi.fn(),
    };

    const router = new ProviderRouter({ providers: [mockProvider] });
    const discovery = new ModelDiscoveryService({ router });
    const config = createConfig();

    await discovery.discoverModels(config);
    discovery.clearCache();
    await discovery.discoverModels(config);

    expect(getModelsSpy).toHaveBeenCalledTimes(2);
  });

  describe("extractCapabilities", () => {
    it("should estimate context window correctly based on model name substrings", () => {
      const discovery = new ModelDiscoveryService();

      expect(discovery.extractCapabilities("qwen-32k").contextWindow).toBe(32768);
      expect(discovery.extractCapabilities("llama-16k").contextWindow).toBe(16384);
      expect(discovery.extractCapabilities("code-128k").contextWindow).toBe(131072);
      expect(discovery.extractCapabilities("qwen-2.5-coder").contextWindow).toBe(8192);
      expect(discovery.extractCapabilities("generic-model").contextWindow).toBe(4096);
    });
  });
});
