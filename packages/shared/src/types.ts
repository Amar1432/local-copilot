/**
 * Provider type identifiers
 */
export type ProviderType = "custom" | "ollama" | "openai" | "lmstudio" | "vllm";

/**
 * Connection status for a provider
 */
export type ConnectionStatus = "connected" | "disconnected" | "checking";

/**
 * Provider configuration from VS Code settings
 */
export interface ProviderConfig {
  readonly enabled: boolean;
  readonly provider: ProviderType;
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly model: string;
  readonly debounceMs: number;
  readonly requestTimeoutMs: number;
  readonly maxOutputTokens: number;
  readonly temperature: number;
  readonly contextMaxLines: number;
  readonly localOnly: boolean;
  readonly telemetryEnabled: boolean;
  readonly useFim?: boolean;
  readonly fimTemplate?: string;
}

/**
 * A completion request sent to a provider
 */
export interface CompletionRequest {
  readonly documentUri: string;
  readonly documentVersion: number;
  readonly language: string;
  readonly prefix: string;
  readonly suffix: string;
  readonly position: { readonly line: number; readonly character: number };
  readonly useFim?: boolean;
}

/**
 * A completion response from a provider
 */
export interface CompletionResponse {
  readonly text: string;
  readonly latencyMs: number;
}

/**
 * Diagnostics information for the status panel
 */
export interface DiagnosticsInfo {
  readonly provider: ProviderType;
  readonly model: string;
  readonly status: ConnectionStatus;
  readonly latencyMs: number | null;
  readonly lastRequestStatus: "success" | "failure" | "cancelled" | null;
  readonly lastRequestTokens: number | null;
  readonly cacheHits: number;
  readonly cacheMisses: number;
  readonly totalRequests: number;
}
