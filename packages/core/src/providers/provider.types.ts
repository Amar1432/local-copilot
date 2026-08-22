import type { CompletionRequest, CompletionResponse, ProviderConfig } from "@local-copilot/shared";

/**
 * Authentication type required by a provider or model
 */
export type AuthType = "none" | "apiKey" | "bearer" | "custom";

/**
 * Provider capabilities describing what features a provider supports
 */
export interface ProviderCapabilities {
  /** Supports streaming responses */
  readonly streaming: boolean;
  /** Supports fill-in-the-middle (FIM) */
  readonly fim: boolean;
  /** Supports stop sequences */
  readonly stopSequences: boolean;
  /** Supports dynamic model listing via API */
  readonly modelListing: boolean;
  /** Default or maximum context window size in tokens */
  readonly contextWindow?: number;
  /** Maximum output tokens supported */
  readonly maxOutputTokens?: number;
  /** Authentication method required */
  readonly auth: AuthType;
}

/**
 * Capabilities specific to an individual model
 */
export interface ModelCapabilities {
  /** Supports streaming responses */
  readonly streaming: boolean;
  /** Supports fill-in-the-middle */
  readonly fim: boolean;
  /** Supports stop sequences */
  readonly stopSequences: boolean;
  /** Context window size in tokens */
  readonly contextWindow: number;
  /** Maximum output tokens */
  readonly maxOutputTokens?: number;
  /** Authentication method required */
  readonly auth: AuthType;
}

/**
 * Metadata for a model available on a provider
 */
export interface ModelInfo {
  /** Unique model identifier */
  readonly id: string;
  /** Human-readable display name */
  readonly name?: string;
  /** Model capabilities */
  readonly capabilities: ModelCapabilities;
  /** Context window size in tokens */
  readonly contextWindow?: number;
  /** Optional description */
  readonly description?: string;
}

/**
 * Provider error code classification
 */
export type ProviderErrorCode =
  | "authentication"
  | "not_found"
  | "timeout"
  | "rate_limit"
  | "network"
  | "invalid_request"
  | "unknown";

/**
 * Details for instantiating a ProviderError
 */
export interface ProviderErrorDetails {
  readonly code: ProviderErrorCode;
  readonly message: string;
  readonly retryable: boolean;
  readonly statusCode?: number;
  readonly cause?: unknown;
}

/**
 * Custom error class for provider domain errors
 */
export class ProviderError extends Error {
  readonly code: ProviderErrorCode;
  readonly retryable: boolean;
  readonly statusCode?: number;

  constructor(details: ProviderErrorDetails) {
    super(details.message);
    this.name = "ProviderError";
    this.code = details.code;
    this.retryable = details.retryable;
    this.statusCode = details.statusCode;
    if (details.cause) {
      this.cause = details.cause;
    }
  }
}

/**
 * CompletionProvider interface that all LLM completion providers must implement
 */
export interface CompletionProvider {
  /** Unique provider identifier (e.g. 'custom', 'ollama', 'openai', 'lmstudio', 'vllm') */
  readonly id: string;

  /** Provider capabilities metadata */
  readonly capabilities?: ProviderCapabilities;

  /** Validate provider configuration */
  validateConfig(config: ProviderConfig): Promise<void>;

  /** List available models from the provider endpoint */
  getModels(signal?: AbortSignal): Promise<ModelInfo[]>;

  /** Generate completions */
  complete(
    request: CompletionRequest,
    signal: AbortSignal
  ): Promise<CompletionResponse | null>;
}
