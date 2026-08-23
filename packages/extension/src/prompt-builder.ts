/**
 * Prompt Builder — constructs prompts for OpenAI-compatible completion APIs.
 *
 * Supports two modes:
 * 1. Standard mode: Prefix-based continuation
 * 2. FIM mode: Fill-in-the-middle with prefix + suffix
 */

import type { CompletionRequest } from "@local-copilot/shared";

/**
 * Build the messages array for an OpenAI-compatible chat completions endpoint.
 *
 * Uses a system prompt that instructs the model to act as a code completion engine,
 * followed by the prefix as user context.
 */
export function buildStandardMessages(
  request: CompletionRequest
): Array<{ readonly role: string; readonly content: string }> {
  const fileName = request.documentUri ? request.documentUri.split("/").pop() ?? "" : "";
  const systemParts = [
    "You are a code completion engine.",
    "",
    `Language: ${request.language}`,
    fileName ? `File: ${fileName}` : "",
    "",
    `Complete only the code at the cursor position in ${request.language}.`,
    "Do not explain. Do not repeat existing text.",
    `Return only ${request.language} code that should be inserted.`,
    "Do not include markdown fences or backticks.",
  ].filter(Boolean);

  // Inject serialized multi-file context chunks when available
  if (request.contextText) {
    systemParts.push("");
    systemParts.push("Use the following relevant code context to inform your completion:");
    systemParts.push(request.contextText);
  }

  const systemPrompt = systemParts.join("\n");

  const commentPrefix = request.language === "python" ? "#" : "//";
  const userContent = [
    fileName ? `${commentPrefix} File: ${fileName} (${request.language})` : "",
    request.prefix ? `<PREFIX>\n${request.prefix}</PREFIX>` : "",
    request.suffix ? `<SUFFIX>\n${request.suffix}</SUFFIX>` : "",
    "<COMPLETION>",
  ]
    .filter(Boolean)
    .join("\n\n");

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userContent },
  ];
}

/**
 * Build a prompt using FIM (Fill-in-the-Middle) tokens.
 *
 * Many code models (DeepSeek, Qwen, Starcoder) support special FIM tokens:
 *   <PRE> prefix <SUF> suffix <MID>
 */
export function buildFIMPrompt(request: CompletionRequest): string {
  const parts: string[] = [];

  if (request.prefix) {
    parts.push(`<PRE> ${request.prefix}`);
  } else {
    parts.push("<PRE>");
  }

  parts.push("<SUF>");

  if (request.suffix) {
    parts.push(`${request.suffix} <MID>`);
  } else {
    parts.push("<MID>");
  }

  return parts.join(" ");
}
