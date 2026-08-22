import { describe, expect, it } from "vitest";
import { deduplicateChunks } from "./context-dedup";
import { type ContextChunk } from "./context.types";

describe("deduplicateChunks", () => {
  const makeChunk = (
    id: string,
    score: number,
    opts: { symbolName?: string; content?: string; uri?: string } = {}
  ): ContextChunk => ({
    id,
    type: "definition",
    uri: opts.uri ?? `file:///${id}.ts`,
    content: opts.content ?? `// ${id}`,
    score,
    symbolName: opts.symbolName,
  });

  it("should deduplicate chunks with the same symbolName, keeping highest score", () => {
    const chunks = [
      makeChunk("a", 70, { symbolName: "UserService", uri: "file:///a.ts" }),
      makeChunk("b", 90, { symbolName: "UserService", uri: "file:///b.ts" }),
      makeChunk("c", 50, { symbolName: "UserService", uri: "file:///c.ts" }),
    ];

    const result = deduplicateChunks(chunks);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("b");
    expect(result[0].score).toBe(90);
  });

  it("should preserve different symbol names as distinct", () => {
    const chunks = [
      makeChunk("a", 80, { symbolName: "UserService" }),
      makeChunk("b", 70, { symbolName: "UserProfile" }),
    ];

    const result = deduplicateChunks(chunks);
    expect(result).toHaveLength(2);
    expect(result.map((c) => c.symbolName)).toEqual(["UserService", "UserProfile"]);
  });

  it("should deduplicate content-similar chunks without symbolName", () => {
    const sharedContent = "export function helper() { return 42; }";
    const chunks = [
      makeChunk("a", 60, { content: sharedContent }),
      makeChunk("b", 80, { content: sharedContent }),
    ];

    const result = deduplicateChunks(chunks);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("b");
  });

  it("should keep chunks with different content as distinct", () => {
    const chunks = [
      makeChunk("a", 80, { content: "export function alpha() { return 1; }" }),
      makeChunk("b", 70, { content: "export function beta() { return 2; }" }),
    ];

    const result = deduplicateChunks(chunks);
    expect(result).toHaveLength(2);
  });

  it("should sort final output by score descending, then id", () => {
    const chunks = [
      makeChunk("low", 30),
      makeChunk("high", 90),
      makeChunk("med", 60),
    ];

    const result = deduplicateChunks(chunks);
    expect(result.map((c) => c.id)).toEqual(["high", "med", "low"]);
  });

  it("should return empty for empty input", () => {
    expect(deduplicateChunks([])).toEqual([]);
  });

  it("should handle mixed symbol and content dedup in one pass", () => {
    const chunks = [
      makeChunk("s1", 70, { symbolName: "Foo", uri: "file:///a.ts" }),
      makeChunk("s2", 90, { symbolName: "Foo", uri: "file:///b.ts" }),
      makeChunk("c1", 80, { content: "export const X = 1;" }),
      makeChunk("c2", 60, { content: "export const X = 1;" }),
      makeChunk("unique", 50, { content: "export const Y = 2;" }),
    ];

    const result = deduplicateChunks(chunks);
    expect(result).toHaveLength(3);
    expect(result.find((c) => c.symbolName === "Foo")?.id).toBe("s2");
    expect(result.find((c) => c.content === "export const X = 1;")?.id).toBe("c1");
    expect(result.find((c) => c.content === "export const Y = 2;")).toBeDefined();
  });

  it("should be deterministic regardless of input order", () => {
    const a = makeChunk("a", 90, { symbolName: "X" });
    const b = makeChunk("b", 80, { symbolName: "X" });
    const c = makeChunk("c", 70, { symbolName: "X" });

    const result1 = deduplicateChunks([a, b, c]);
    const result2 = deduplicateChunks([c, a, b]);
    const result3 = deduplicateChunks([b, c, a]);

    expect(result1).toEqual(result2);
    expect(result2).toEqual(result3);
    expect(result1[0].id).toBe("a");
  });

  it("should handle large batches without timing out", () => {
    const chunks: ContextChunk[] = [];
    for (let i = 0; i < 100; i++) {
      chunks.push(makeChunk(`chunk-${i}`, i, { symbolName: `Sym${i % 20}` }));
    }

    const start = performance.now();
    const result = deduplicateChunks(chunks);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(20);
    expect(result.length).toBeLessThanOrEqual(20);
  });
});
