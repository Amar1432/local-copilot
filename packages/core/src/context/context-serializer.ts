/**
 * Context serializer for formatting context chunks into prompt-ready strings.
 */

import type { ContextChunk } from "./context.types";

/**
 * Supported serialization formats
 */
export type ContextSerializationFormat = "xml" | "markdown" | "comment" | "plain";

/**
 * Options for context serialization
 */
export interface ContextSerializationOptions {
  /** Target serialization format (default: "xml") */
  readonly format?: ContextSerializationFormat;
  /** Whether to wrap the entire output in a root context block */
  readonly wrapInBlock?: boolean;
  /** Whether to include chunk metadata (range, symbol name, score) in headers */
  readonly includeMetadata?: boolean;
  /** Comment prefix for comment format (e.g. "//", "#", "--") */
  readonly commentPrefix?: string;
  /** Language identifier for markdown code blocks */
  readonly language?: string;
}

/**
 * Format a single chunk as XML tags
 */
export function formatChunkXml(chunk: ContextChunk, includeMetadata = true): string {
  const attrs: string[] = [
    `type="${chunk.type}"`,
    `file="${chunk.uri}"`,
  ];

  if (includeMetadata) {
    if (chunk.symbolName) {
      attrs.push(`symbol="${chunk.symbolName}"`);
    }
    if (chunk.range) {
      attrs.push(`lines="${chunk.range.startLine}-${chunk.range.endLine}"`);
    }
    attrs.push(`score="${chunk.score}"`);
  }

  return [`<chunk ${attrs.join(" ")}>`, chunk.content, "</chunk>"].join("\n");
}

/**
 * Format a single chunk as Markdown section
 */
export function formatChunkMarkdown(chunk: ContextChunk, includeMetadata = true): string {
  const meta: string[] = [chunk.type];
  if (includeMetadata) {
    if (chunk.symbolName) {
      meta.push(`symbol: ${chunk.symbolName}`);
    }
    if (chunk.range) {
      meta.push(`lines ${chunk.range.startLine}-${chunk.range.endLine}`);
    }
  }

  const lang = chunk.language || "";
  const header = `### Context: ${chunk.uri} (${meta.join(", ")})`;
  return [header, "```" + lang, chunk.content, "```"].join("\n");
}

/**
 * Format a single chunk as language comments
 */
export function formatChunkComment(
  chunk: ContextChunk,
  commentPrefix = "//",
  includeMetadata = true
): string {
  const meta: string[] = [chunk.type];
  if (includeMetadata) {
    if (chunk.symbolName) {
      meta.push(`symbol: ${chunk.symbolName}`);
    }
    if (chunk.range) {
      meta.push(`L${chunk.range.startLine}-L${chunk.range.endLine}`);
    }
  }

  const header = `${commentPrefix} --- Context: ${chunk.uri} (${meta.join(", ")}) ---`;
  return [header, chunk.content].join("\n");
}

/**
 * Format a single chunk as plain text
 */
export function formatChunkPlain(chunk: ContextChunk): string {
  return chunk.content;
}

/**
 * Serialize a collection of context chunks into a prompt string.
 */
export function serializeContextChunks(
  chunks: readonly ContextChunk[],
  options: ContextSerializationOptions = {}
): string {
  if (!chunks || chunks.length === 0) {
    return "";
  }

  const format = options.format ?? "xml";
  const wrapInBlock = options.wrapInBlock ?? (format === "xml");
  const includeMetadata = options.includeMetadata ?? true;

  const formattedChunks = chunks.map((chunk) => {
    switch (format) {
      case "xml":
        return formatChunkXml(chunk, includeMetadata);
      case "markdown":
        return formatChunkMarkdown(chunk, includeMetadata);
      case "comment":
        return formatChunkComment(chunk, options.commentPrefix ?? "//", includeMetadata);
      case "plain":
        return formatChunkPlain(chunk);
      default:
        return formatChunkXml(chunk, includeMetadata);
    }
  });

  const body = formattedChunks.join("\n\n");

  if (wrapInBlock) {
    if (format === "xml") {
      return `<context>\n${body}\n</context>`;
    }
    if (format === "markdown") {
      return `## Relevant Context\n\n${body}`;
    }
  }

  return body;
}
