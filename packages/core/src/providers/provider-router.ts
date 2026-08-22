import type {
  CompletionRequest,
  CompletionResponse,
  ProviderConfig,
} from "@local-copilot/shared";
import type { CompletionProvider, ModelInfo } from "./provider.types";
import { ProviderError } from "./provider.types";
import { validateLocalOnly } from "./privacy";

/**
 * Options for initializing the ProviderRouter
 */
export interface ProviderRouterOptions {
  /** Initial providers to register */
  readonly providers?: ReadonlyArray<CompletionProvider>;
  /** Default fallback provider ID */
  readonly defaultProviderId?: string;
}

/**
 * ProviderRouter manages provider lifecycle, selection based on configuration,
 * configuration validation, and request routing.
 */
export class ProviderRouter {
  private readonly providers: Map<string, CompletionProvider> = new Map();
  private activeProviderId: string | null = null;

  constructor(options?: ProviderRouterOptions) {
    if (options?.providers) {
      for (const provider of options.providers) {
        this.registerProvider(provider);
      }
    }
    if (options?.defaultProviderId) {
      this.activeProviderId = options.defaultProviderId;
    }
  }

  /**
   * Register a new provider instance.
   */
  registerProvider(provider: CompletionProvider): void {
    if (!provider || !provider.id) {
      throw new ProviderError({
        code: "invalid_request",
        message: "Cannot register provider without a valid ID",
        retryable: false,
      });
    }
    this.providers.set(provider.id, provider);
  }

  /**
   * Unregister a provider by ID.
   */
  unregisterProvider(id: string): boolean {
    const deleted = this.providers.delete(id);
    if (this.activeProviderId === id) {
      this.activeProviderId = null;
    }
    return deleted;
  }

  /**
   * Check if a provider with the given ID is registered.
   */
  hasProvider(id: string): boolean {
    return this.providers.has(id);
  }

  /**
   * Get a registered provider by ID.
   */
  getProvider(id: string): CompletionProvider | undefined {
    return this.providers.get(id);
  }

  /**
   * Get all registered provider IDs.
   */
  getRegisteredProviderIds(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Select and return the active provider based on configuration.
   * Updates the active provider ID tracking.
   */
  selectProvider(config: ProviderConfig): CompletionProvider {
    const providerId = config.provider;
    const provider = this.providers.get(providerId);

    if (!provider) {
      throw new ProviderError({
        code: "not_found",
        message: `Provider '${providerId}' is not registered. Registered providers: ${Array.from(this.providers.keys()).join(", ") || "none"}`,
        retryable: false,
      });
    }

    this.activeProviderId = providerId;
    return provider;
  }

  /**
   * Validate the provider configuration using the selected provider.
   */
  async validateConfig(config: ProviderConfig): Promise<void> {
    if (!config.baseUrl) {
      throw new ProviderError({
        code: "invalid_request",
        message: "Configuration error: baseUrl is required",
        retryable: false,
      });
    }

    validateLocalOnly(config.baseUrl, config.localOnly);

    const provider = this.selectProvider(config);
    await provider.validateConfig(config);
  }

  /**
   * Retrieve available models from the provider selected by configuration.
   */
  async getModels(
    config: ProviderConfig,
    signal?: AbortSignal
  ): Promise<ModelInfo[]> {
    try {
      validateLocalOnly(config.baseUrl, config.localOnly);
      const provider = this.selectProvider(config);
      return await provider.getModels(signal);
    } catch (error) {
      if (error instanceof ProviderError) {
        throw error;
      }
      throw new ProviderError({
        code: "unknown",
        message:
          error instanceof Error
            ? error.message
            : "Failed to retrieve models from provider",
        retryable: false,
        cause: error,
      });
    }
  }

  /**
   * Generate a completion using the provider selected by configuration.
   */
  async complete(
    request: CompletionRequest,
    config: ProviderConfig,
    signal: AbortSignal
  ): Promise<CompletionResponse | null> {
    try {
      validateLocalOnly(config.baseUrl, config.localOnly);
      const provider = this.selectProvider(config);
      return await provider.complete(request, signal);
    } catch (error) {
      if (signal.aborted) {
        return null;
      }
      if (error instanceof ProviderError) {
        throw error;
      }
      throw new ProviderError({
        code: "unknown",
        message:
          error instanceof Error
            ? error.message
            : "Provider completion request failed",
        retryable: false,
        cause: error,
      });
    }
  }

  /**
   * Get the ID of the currently active provider, if set.
   */
  get currentProviderId(): string | null {
    return this.activeProviderId;
  }
}
