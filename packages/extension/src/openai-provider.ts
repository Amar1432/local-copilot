/**
 * OpenAI-Compatible Provider — communicates with any endpoint that implements
 * the OpenAI completions API format (Ollama, LM Studio, vLLM, custom).
 *
 * Uses native fetch + AbortController for HTTP requests.
 */

import type { CompletionRequest, ProviderConfig } from "@private-copilot/shared";
import { formatFimPrompt, isFimSupported } from "@private-copilot/core";
import { buildStandardMessages } from "./prompt-builder";

/**
 * Raw response from the OpenAI-compatible completions endpoint.
 */
interface OpenAICompletionResponse {
  readonly id: string;
  readonly choices: ReadonlyArray<{
    readonly message?: { readonly content: string };
    readonly text?: string;
    readonly finish_reason: string;
  }>;
  readonly usage?: {
    readonly prompt_tokens: number;
    readonly completion_tokens: number;
  };
}

/**
 * Send a completion request to an OpenAI-compatible endpoint.
 *
 * @returns The completion text, or null if the request failed or was cancelled.
 */
export async function complete(
  request: CompletionRequest,
  config: ProviderConfig,
  signal: AbortSignal
): Promise<{
  readonly text: string;
  readonly latencyMs: number;
  readonly tokensUsed: number | null;
} | null> {
  const startTime = Date.now();

  const useFim =
    config.useFim !== false &&
    request.useFim !== false &&
    isFimSupported(config.model);

  let messages: Array<{ readonly role: string; readonly content: string }>;
  if (useFim) {
    const fileName = request.documentUri ? request.documentUri.split("/").pop() ?? "" : "";
    const fimPrompt = formatFimPrompt(
      request.prefix,
      request.suffix,
      config.fimTemplate ?? config.model,
      { fileName, language: request.language }
    );
    messages = [
      {
        role: "system",
        content: `You are a code completion engine for ${request.language}.${fileName ? ` File: ${fileName}.` : ""} Complete only the code at cursor position in ${request.language}. Do not explain. Do not output code in any other language.`,
      },
      {
        role: "user",
        content: fimPrompt,
      },
    ];
  } else {
    messages = buildStandardMessages(request);
  }

  // Build the request body
  const body = {
    model: config.model,
    messages,
    max_tokens: config.maxOutputTokens,
    temperature: config.temperature,
    stream: false,
    stop: [
      "</COMPLETION>",
      "<COMPLETION>",
      "<PREFIX>",
      "<SUFFIX>",
      "<|endoftext|>",
      "<|file_separator|>",
    ],
  };

  // Determine the endpoint URL
  const url = resolveEndpointUrl(config);

  // Build headers
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (config.apiKey) {
    headers["Authorization"] = `Bearer ${config.apiKey}`;
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      console.error(`[Private Copilot] Provider error ${response.status}: ${errorText}`);
      return null;
    }

    const data = (await response.json()) as OpenAICompletionResponse;
    const latencyMs = Date.now() - startTime;

    // Extract text from the response
    const choice = data.choices?.[0];
    if (!choice) return null;

    // OpenAI chat completions use message.content
    // Some endpoints use text field directly
    const text = choice.message?.content ?? choice.text ?? "";
    if (!text.trim()) return null;

    const tokensUsed = data.usage?.completion_tokens ?? null;

    return { text, latencyMs, tokensUsed };
  } catch (error: unknown) {
    // AbortError means the request was cancelled — that's expected
    if (error instanceof DOMException && error.name === "AbortError") {
      return null;
    }
    console.error("[Private Copilot] Request failed:", error);
    return null;
  }
}

/**
 * Test the connection to the provider endpoint.
 *
 * @returns true if the connection succeeded.
 */
export async function testConnection(
  config: ProviderConfig,
  signal?: AbortSignal
): Promise<boolean> {
  const url = resolveEndpointUrl(config);

  try {
    const headers: Record<string, string> = {};
    if (config.apiKey) {
      headers["Authorization"] = `Bearer ${config.apiKey}`;
    }

    // Try to list models as a connection test
    const modelsUrl = url.replace(/\/chat\/completions$/, "/models");
    const response = await fetch(modelsUrl, {
      method: "GET",
      headers,
      signal,
    });

    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Resolve the full endpoint URL based on the provider config.
 *
 * Appends /chat/completions to the base URL if not already present.
 */
function resolveEndpointUrl(config: ProviderConfig): string {
  let baseUrl = config.baseUrl.replace(/\/+$/, "");

  // Ensure the URL ends with /chat/completions
  if (!baseUrl.endsWith("/chat/completions")) {
    // Some providers use /v1/chat/completions, others just /chat/completions
    if (!baseUrl.endsWith("/v1")) {
      baseUrl = `${baseUrl}/v1`;
    }
    baseUrl = `${baseUrl}/chat/completions`;
  }

  return baseUrl;
}
