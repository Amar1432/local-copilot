import { describe, expect, it } from "vitest";
import {
  formatChunkComment,
  formatChunkMarkdown,
  formatChunkPlain,
  formatChunkXml,
  serializeContextChunks,
} from "./context-serializer";
import { ContextPriority, type ContextChunk } from "./context.types";

describe("Context Serializer", () => {
  const sampleChunk: ContextChunk = {
    id: "chunk-1",
    type: "import",
    uri: "src/utils/math.ts",
    content: "export function add(a: number, b: number): number { return a + b; }",
    score: ContextPriority.HIGH,
    symbolName: "add",
    range: { startLine: 1, endLine: 3 },
    language: "typescript",
  };

  it("should format chunk as XML", () => {
    const xml = formatChunkXml(sampleChunk);
    expect(xml).toContain("<chunk ");
    expect(xml).toContain('type="import"');
    expect(xml).toContain('file="src/utils/math.ts"');
    expect(xml).toContain('symbol="add"');
    expect(xml).toContain('lines="1-3"');
    expect(xml).toContain("export function add");
    expect(xml).toContain("</chunk>");
  });

  it("should format chunk as Markdown", () => {
    const md = formatChunkMarkdown(sampleChunk);
    expect(md).toContain("### Context: src/utils/math.ts (import, symbol: add, lines 1-3)");
    expect(md).toContain("```typescript");
    expect(md).toContain("export function add");
    expect(md).toContain("```");
  });

  it("should format chunk as Comments", () => {
    const comment = formatChunkComment(sampleChunk, "//");
    expect(comment).toContain("// --- Context: src/utils/math.ts (import, symbol: add, L1-L3) ---");
    expect(comment).toContain("export function add");
  });

  it("should format chunk as Plain text", () => {
    const plain = formatChunkPlain(sampleChunk);
    expect(plain).toBe(sampleChunk.content);
  });

  it("should serialize multiple chunks wrapped in XML context root by default", () => {
    const chunk2: ContextChunk = {
      id: "chunk-2",
      type: "definition",
      uri: "src/types.ts",
      content: "export type MathOp = (a: number, b: number) => number;",
      score: ContextPriority.CRITICAL,
      symbolName: "MathOp",
    };

    const serialized = serializeContextChunks([sampleChunk, chunk2]);
    expect(serialized.startsWith("<context>")).toBe(true);
    expect(serialized.endsWith("</context>")).toBe(true);
    expect(serialized).toContain('file="src/utils/math.ts"');
    expect(serialized).toContain('file="src/types.ts"');
  });

  it("should serialize chunks to markdown format with header block", () => {
    const serialized = serializeContextChunks([sampleChunk], { format: "markdown", wrapInBlock: true });
    expect(serialized).toContain("## Relevant Context");
    expect(serialized).toContain("### Context: src/utils/math.ts");
  });

  it("should return empty string for empty chunks", () => {
    expect(serializeContextChunks([])).toBe("");
  });
});
