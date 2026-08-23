import type {
  CompletionRequest,
  CompletionResponse,
  ProviderConfig,
} from "@private-copilot/shared";
import type {
  CompletionProvider,
  ModelInfo,
  ProviderCapabilities,
} from "./provider.types";
import { ProviderError } from "./provider.types";
import { formatFimPrompt, isFimSupported } from "./fim";
import { validateLocalOnly } from "./privacy";

/**
 * Options for configuring OpenAICompatibleProvider
 */
export interface OpenAICompatibleProviderOptions {
  /** Unique provider identifier */
  readonly id?: string;
  /** Active provider configuration */
  readonly config?: ProviderConfig;
  /** Custom provider capabilities */
  readonly capabilities?: Partial<ProviderCapabilities>;
  /** Optional custom fetch implementation (useful for tests/mocking) */
  readonly customFetch?: typeof fetch;
}

/**
 * Adapter for OpenAI-compatible completions endpoints (Ollama, LM Studio, vLLM, OpenAI, custom).
 */
export class OpenAICompatibleProvider implements CompletionProvider {
  readonly id: string;
  readonly capabilities: ProviderCapabilities;
  private config?: ProviderConfig;
  private readonly fetchFn: typeof fetch;

  constructor(options?: OpenAICompatibleProviderOptions) {
    this.id = options?.id ?? options?.config?.provider ?? "custom";
    this.config = options?.config;
    this.fetchFn = options?.customFetch ?? fetch;

    this.capabilities = {
      streaming: true,
      fim: true,
      stopSequences: true,
      modelListing: true,
      auth: "apiKey",
      ...options?.capabilities,
    };
  }

  /**
   * Update the active provider configuration.
   */
  updateConfig(config: ProviderConfig): void {
    this.config = config;
  }

  /**
   * Get the current provider configuration.
   */
  getConfig(): ProviderConfig | undefined {
    return this.config;
  }

  /**
   * Validate that the provider configuration is structurally sound.
   */
  async validateConfig(config: ProviderConfig): Promise<void> {
    if (!config.baseUrl || !config.baseUrl.trim()) {
      throw new ProviderError({
        code: "invalid_request",
        message: "Provider configuration requires a valid baseUrl",
        retryable: false,
      });
    }

    try {
      const parsed = new URL(config.baseUrl);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new ProviderError({
          code: "invalid_request",
          message: `Invalid protocol '${parsed.protocol}'. Base URL must use HTTP or HTTPS.`,
          retryable: false,
        });
      }
    } catch (err) {
      if (err instanceof ProviderError) {
        throw err;
      }
      throw new ProviderError({
        code: "invalid_request",
        message: `Invalid baseUrl '${config.baseUrl}'. Must be a valid HTTP/HTTPS URL.`,
        retryable: false,
      });
    }

    validateLocalOnly(config.baseUrl, config.localOnly);
  }

  /**
   * Fetch available models from GET /models on the provider endpoint.
   */
  async getModels(signal?: AbortSignal): Promise<ModelInfo[]> {
    const config = this.config;
    if (!config) {
      throw new ProviderError({
        code: "invalid_request",
        message: "Provider has not been configured with a baseUrl",
        retryable: false,
      });
    }

    validateLocalOnly(config.baseUrl, config.localOnly);

    const modelsUrl = this.resolveModelsUrl(config.baseUrl);
    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    if (config.apiKey) {
      headers["Authorization"] = `Bearer ${config.apiKey}`;
    }

    try {
      const response = await this.fetchFn(modelsUrl, {
        method: "GET",
        headers,
        signal,
      });

      if (!response.ok) {
        await this.handleHttpError(response);
      }

      const body = (await response.json()) as
        | { data?: Array<{ id?: string; name?: string }> }
        | Array<{ id?: string; name?: string }>;
      const data = Array.isArray(body)
        ? body
        : Array.isArray(body?.data)
          ? body.data
          : [];

      return data.map((item) => {
        const id = item.id || String(item);
        const fimCapability = isFimSupported(id);
        return {
          id,
          name: item.name || id,
          capabilities: {
            streaming: true,
            fim: fimCapability,
            stopSequences: true,
            contextWindow: 4096,
            auth: config.apiKey ? "apiKey" : "none",
          },
        };
      });
    } catch (error) {
      if (signal?.aborted) {
        return [];
      }
      if (error instanceof ProviderError) {
        throw error;
      }
      throw new ProviderError({
        code: "network",
        message:
          error instanceof Error
            ? error.message
            : "Failed to connect to provider endpoint",
        retryable: true,
        cause: error,
      });
    }
  }

  /**
   * Execute a non-streaming completion request.
   */
  async complete(
    request: CompletionRequest,
    signal: AbortSignal
  ): Promise<CompletionResponse | null> {
    const config = this.config;
    if (!config) {
      throw new ProviderError({
        code: "invalid_request",
        message: "Cannot execute complete: provider configuration is missing",
        retryable: false,
      });
    }

    if (!config.model) {
      return null;
    }

    validateLocalOnly(config.baseUrl, config.localOnly);

    const url = this.resolveChatUrl(config.baseUrl);
    const startTime = Date.now();

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (config.apiKey) {
      headers["Authorization"] = `Bearer ${config.apiKey}`;
    }

    const useFim =
      this.capabilities.fim &&
      config.useFim !== false &&
      request.useFim !== false &&
      isFimSupported(config.model, this.capabilities);

    let messages: Array<{ readonly role: string; readonly content: string }>;

    if (useFim) {
      const fimPrompt = formatFimPrompt(
        request.prefix,
        request.suffix,
        config.fimTemplate ?? config.model
      );
      messages = [
        {
          role: "user",
          content: fimPrompt,
        },
      ];
    } else {
      messages = [
        {
          role: "system",
          content: [
            "You are a code completion engine.",
            `Language: ${request.language}`,
            "Complete only the code at the cursor position.",
            "Do not explain. Do not repeat existing text.",
            "Return only code that should be inserted.",
            "Do not include markdown fences or backticks.",
          ].join("\n"),
        },
        {
          role: "user",
          content: [
            request.prefix ? `<PREFIX>\n${request.prefix}</PREFIX>` : "",
            request.suffix ? `<SUFFIX>\n${request.suffix}</SUFFIX>` : "",
            "<COMPLETION>",
          ]
            .filter(Boolean)
            .join("\n\n"),
        },
      ];
    }

    const body = {
      model: config.model,
      messages,
      max_tokens: config.maxOutputTokens,
      temperature: config.temperature,
      stream: false,
    };

    try {
      const response = await this.fetchFn(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal,
      });

      if (!response.ok) {
        await this.handleHttpError(response);
      }

      const data = (await response.json()) as {
        choices?: Array<{
          message?: { content?: string };
          text?: string;
        }>;
      };
      const latencyMs = Date.now() - startTime;

      const choice = data.choices?.[0];
      if (!choice) {
        return null;
      }

      const text = choice.message?.content ?? choice.text ?? "";
      return {
        text,
        latencyMs,
      };
    } catch (error) {
      if (
        signal.aborted ||
        (error instanceof DOMException && error.name === "AbortError")
      ) {
        return null;
      }
      if (error instanceof ProviderError) {
        throw error;
      }
      throw new ProviderError({
        code: "network",
        message:
          error instanceof Error
            ? error.message
            : "Completion request failed",
        retryable: true,
        cause: error,
      });
    }
  }

  /**
   * Process streaming response via Server-Sent Events (SSE).
   */
  async *completeStream(
    request: CompletionRequest,
    signal: AbortSignal
  ): AsyncGenerator<string, void, unknown> {
    const config = this.config;
    if (!config || !config.model) {
      return;
    }

    validateLocalOnly(config.baseUrl, config.localOnly);

    const url = this.resolveChatUrl(config.baseUrl);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    };
    if (config.apiKey) {
      headers["Authorization"] = `Bearer ${config.apiKey}`;
    }

    const useFim =
      this.capabilities.fim &&
      config.useFim !== false &&
      request.useFim !== false &&
      isFimSupported(config.model, this.capabilities);

    let messages: Array<{ readonly role: string; readonly content: string }>;

    if (useFim) {
      const fimPrompt = formatFimPrompt(
        request.prefix,
        request.suffix,
        config.fimTemplate ?? config.model
      );
      messages = [
        {
          role: "user",
          content: fimPrompt,
        },
      ];
    } else {
      messages = [
        {
          role: "system",
          content: [
            "You are a code completion engine.",
            `Language: ${request.language}`,
            "Complete only the code at the cursor position.",
            "Do not explain. Do not repeat existing text.",
            "Return only code that should be inserted.",
            "Do not include markdown fences or backticks.",
          ].join("\n"),
        },
        {
          role: "user",
          content: [
            request.prefix ? `<PREFIX>\n${request.prefix}</PREFIX>` : "",
            request.suffix ? `<SUFFIX>\n${request.suffix}</SUFFIX>` : "",
            "<COMPLETION>",
          ]
            .filter(Boolean)
            .join("\n\n"),
        },
      ];
    }

    const body = {
      model: config.model,
      messages,
      max_tokens: config.maxOutputTokens,
      temperature: config.temperature,
      stream: true,
    };

    const response = await this.fetchFn(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      await this.handleHttpError(response);
    }

    if (!response.body) {
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (!signal.aborted) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(":")) continue;
          if (trimmed === "data: [DONE]") return;

          if (trimmed.startsWith("data: ")) {
            const dataStr = trimmed.slice(6);
            try {
              const parsed = JSON.parse(dataStr) as {
                choices?: Array<{
                  delta?: { content?: string };
                  text?: string;
                }>;
              };
              const delta =
                parsed.choices?.[0]?.delta?.content ??
                parsed.choices?.[0]?.text ??
                "";
              if (delta) {
                yield delta;
              }
            } catch {
              // Ignore partial JSON parse errors in stream
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Resolve full chat completions URL from baseUrl.
   */
  private resolveChatUrl(baseUrl: string): string {
    let clean = baseUrl.replace(/\/+$/, "");
    if (!clean.endsWith("/chat/completions")) {
      if (!clean.endsWith("/v1")) {
        clean = `${clean}/v1`;
      }
      clean = `${clean}/chat/completions`;
    }
    return clean;
  }

  /**
   * Resolve models endpoint URL from baseUrl.
   */
  private resolveModelsUrl(baseUrl: string): string {
    let clean = baseUrl.replace(/\/+$/, "");
    if (clean.endsWith("/chat/completions")) {
      clean = clean.replace(/\/chat\/completions$/, "/models");
    } else if (!clean.endsWith("/models")) {
      if (!clean.endsWith("/v1")) {
        clean = `${clean}/v1`;
      }
      clean = `${clean}/models`;
    }
    return clean;
  }

  /**
   * Classify and throw appropriate ProviderError based on HTTP status.
   */
  private async handleHttpError(response: Response): Promise<never> {
    const errorText = await response.text().catch(() => "");
    const status = response.status;

    if (status === 401 || status === 403) {
      throw new ProviderError({
        code: "authentication",
        message: `Authentication failed (${status}): ${errorText || "Invalid credentials"}`,
        retryable: false,
        statusCode: status,
      });
    }

    if (status === 404) {
      throw new ProviderError({
        code: "not_found",
        message: `Model or endpoint not found (${status}): ${errorText || "Resource not found"}`,
        retryable: false,
        statusCode: status,
      });
    }

    if (status === 429) {
      throw new ProviderError({
        code: "rate_limit",
        message: `Rate limit exceeded (${status}): ${errorText || "Too many requests"}`,
        retryable: true,
        statusCode: status,
      });
    }

    if (status >= 500) {
      throw new ProviderError({
        code: "network",
        message: `Server error (${status}): ${errorText || "Internal server error"}`,
        retryable: true,
        statusCode: status,
      });
    }

    throw new ProviderError({
      code: "invalid_request",
      message: `HTTP error (${status}): ${errorText || "Bad request"}`,
      retryable: false,
      statusCode: status,
    });
  }
}
