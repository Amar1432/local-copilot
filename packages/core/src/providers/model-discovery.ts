import type { ProviderConfig } from "@private-copilot/shared";
import type { ModelCapabilities, ModelInfo } from "./provider.types";
import { isFimSupported } from "./fim";
import type { ProviderRouter } from "./provider-router";

export interface ModelDiscoveryOptions {
  /** Time-to-live for cached model lists in milliseconds (default 5 minutes) */
  readonly ttlMs?: number;
  /** Router instance to delegate getModels calls to */
  readonly router?: ProviderRouter;
}

interface CacheEntry {
  readonly models: ReadonlyArray<ModelInfo>;
  readonly timestamp: number;
}

/**
 * ModelDiscoveryService handles dynamic discovery of available models from provider endpoints,
 * caching of model lists, capability extraction, and fallback to manual entry.
 */
export class ModelDiscoveryService {
  private readonly cache: Map<string, CacheEntry> = new Map();
  private readonly ttlMs: number;
  private readonly router?: ProviderRouter;

  constructor(options?: ModelDiscoveryOptions) {
    this.ttlMs = options?.ttlMs ?? 5 * 60 * 1000; // 5 minutes default
    this.router = options?.router;
  }

  /**
   * Discover available models from the configured provider endpoint.
   * Uses cached results if available and not expired unless forceRefresh is true.
   */
  async discoverModels(
    config: ProviderConfig,
    options?: { readonly forceRefresh?: boolean; readonly signal?: AbortSignal }
  ): Promise<ModelInfo[]> {
    const cacheKey = this.computeCacheKey(config);

    if (!options?.forceRefresh) {
      const cached = this.getCachedModels(cacheKey);
      if (cached !== null) {
        return cached;
      }
    }

    try {
      let models: ModelInfo[] = [];

      if (this.router) {
        models = await this.router.getModels(config, options?.signal);
      } else {
        models = await this.fetchModelsDirect(config, options?.signal);
      }

      // Enrich capabilities for each discovered model
      const enrichedModels = models.map((m) => this.enrichModelInfo(m, config));

      this.cache.set(cacheKey, {
        models: enrichedModels,
        timestamp: Date.now(),
      });

      return enrichedModels;
    } catch {
      // If live discovery fails, fallback to cached models if available
      const existing = this.cache.get(cacheKey);
      if (existing) {
        return [...existing.models];
      }

      // Fallback: If a model is configured, return fallback metadata for it
      if (config.model) {
        return [this.createFallbackModel(config.model, config)];
      }

      return [];
    }
  }

  /**
   * Extract model capabilities from model ID and optional raw metadata.
   */
  extractCapabilities(
    modelId: string,
    rawMetadata?: Record<string, unknown>
  ): ModelCapabilities {
    const fim =
      typeof rawMetadata?.fim === "boolean"
        ? rawMetadata.fim
        : isFimSupported(modelId);

    const streaming =
      typeof rawMetadata?.streaming === "boolean"
        ? rawMetadata.streaming
        : true;

    const stopSequences =
      typeof rawMetadata?.stopSequences === "boolean"
        ? rawMetadata.stopSequences
        : true;

    const contextWindow =
      typeof rawMetadata?.contextWindow === "number"
        ? rawMetadata.contextWindow
        : this.estimateContextWindow(modelId);

    const auth =
      typeof rawMetadata?.auth === "string" &&
      (rawMetadata.auth === "none" ||
        rawMetadata.auth === "apiKey" ||
        rawMetadata.auth === "bearer" ||
        rawMetadata.auth === "custom")
        ? rawMetadata.auth
        : "apiKey";

    return {
      streaming,
      fim,
      stopSequences,
      contextWindow,
      auth,
    };
  }

  /**
   * Create fallback ModelInfo for manually specified models.
   */
  createFallbackModel(modelId: string, config?: ProviderConfig): ModelInfo {
    return {
      id: modelId,
      name: modelId,
      capabilities: this.extractCapabilities(modelId, {
        auth: config?.apiKey ? "apiKey" : "none",
      }),
      description: "Manually configured model",
    };
  }

  /**
   * Get cached models for a cache key if not expired.
   */
  getCachedModels(cacheKey: string): ModelInfo[] | null {
    const entry = this.cache.get(cacheKey);
    if (!entry) {
      return null;
    }

    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(cacheKey);
      return null;
    }

    return [...entry.models];
  }

  /**
   * Clear all cached model discoveries.
   */
  clearCache(): void {
    this.cache.clear();
  }

  private computeCacheKey(config: ProviderConfig): string {
    return `${config.provider}:${config.baseUrl}`;
  }

  private enrichModelInfo(model: ModelInfo, config: ProviderConfig): ModelInfo {
    const capabilities = this.extractCapabilities(model.id, {
      ...model.capabilities,
      auth: config.apiKey ? "apiKey" : "none",
    });

    return {
      ...model,
      capabilities,
      contextWindow: model.contextWindow ?? capabilities.contextWindow,
    };
  }

  private estimateContextWindow(modelId: string): number {
    const lower = modelId.toLowerCase();
    if (lower.includes("128k")) return 131072;
    if (lower.includes("64k")) return 65536;
    if (lower.includes("32k")) return 32768;
    if (lower.includes("16k")) return 16384;
    if (lower.includes("8k")) return 8192;
    if (lower.includes("qwen") || lower.includes("deepseek")) return 8192;
    return 4096;
  }

  private async fetchModelsDirect(
    config: ProviderConfig,
    signal?: AbortSignal
  ): Promise<ModelInfo[]> {
    let clean = config.baseUrl.replace(/\/+$/, "");
    if (clean.endsWith("/chat/completions")) {
      clean = clean.replace(/\/chat\/completions$/, "/models");
    } else if (!clean.endsWith("/models")) {
      if (!clean.endsWith("/v1")) {
        clean = `${clean}/v1`;
      }
      clean = `${clean}/models`;
    }

    const headers: Record<string, string> = { Accept: "application/json" };
    if (config.apiKey) {
      headers["Authorization"] = `Bearer ${config.apiKey}`;
    }

    const response = await fetch(clean, {
      method: "GET",
      headers,
      signal,
    });

    if (!response.ok) {
      return [];
    }

    const body = (await response.json()) as
      | { data?: Array<{ id?: string; name?: string }> }
      | Array<{ id?: string; name?: string }>;
    const data = Array.isArray(body)
      ? body
      : Array.isArray(body?.data)
        ? body.data
        : [];

    return data.map((item) => ({
      id: item.id || String(item),
      name: item.name || item.id || String(item),
      capabilities: this.extractCapabilities(item.id || String(item)),
    }));
  }
}
