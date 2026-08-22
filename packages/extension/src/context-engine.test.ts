import { describe, it, expect } from "vitest";
import { buildCompletionRequest, generateRequestId, computeFingerprint } from "./context-engine";

describe("context-engine", () => {
  // -----------------------------------------------------------------------
  // buildCompletionRequest
  // -----------------------------------------------------------------------

  describe("buildCompletionRequest", () => {
    it("should extract prefix and suffix around cursor", () => {
      const request = buildCompletionRequest({
        documentUri: "file:///test.ts",
        documentVersion: 1,
        language: "typescript",
        fullText: "function hello() {\n  console.log();\n}",
        cursorLine: 1,
        cursorCharacter: 14,
        maxLines: 10,
      });

      expect(request.documentUri).toBe("file:///test.ts");
      expect(request.language).toBe("typescript");
      expect(request.prefix).toContain("function hello()");
      expect(request.suffix).toContain("}");
      expect(request.position.line).toBe(1);
      expect(request.position.character).toBe(14);
    });

    it("should respect maxLines for prefix", () => {
      const lines = Array.from({ length: 50 }, (_, i) => `line ${i}`);
      const fullText = lines.join("\n");

      const request = buildCompletionRequest({
        documentUri: "file:///test.ts",
        documentVersion: 1,
        language: "typescript",
        fullText,
        cursorLine: 40,
        cursorCharacter: 6,
        maxLines: 5,
      });

      const prefixLines = request.prefix.split("\n");
      expect(prefixLines.length).toBeLessThanOrEqual(6); // 5 lines + possibly partial
    });

    it("should handle cursor at line 0", () => {
      const request = buildCompletionRequest({
        documentUri: "file:///test.ts",
        documentVersion: 1,
        language: "typescript",
        fullText: "const x = 1;",
        cursorLine: 0,
        cursorCharacter: 10,
        maxLines: 10,
      });

      expect(request.prefix).toBe("");
      expect(request.suffix).toBe("");
    });

    it("should handle empty document", () => {
      const request = buildCompletionRequest({
        documentUri: "file:///test.ts",
        documentVersion: 1,
        language: "typescript",
        fullText: "",
        cursorLine: 0,
        cursorCharacter: 0,
        maxLines: 10,
      });

      expect(request.prefix).toBe("");
      expect(request.suffix).toBe("");
    });
  });

  // -----------------------------------------------------------------------
  // generateRequestId
  // -----------------------------------------------------------------------

  describe("generateRequestId", () => {
    it("should generate unique IDs", () => {
      const id1 = generateRequestId();
      const id2 = generateRequestId();
      expect(id1).not.toBe(id2);
    });

    it("should start with req-", () => {
      const id = generateRequestId();
      expect(id).toMatch(/^req-/);
    });
  });

  // -----------------------------------------------------------------------
  // computeFingerprint
  // -----------------------------------------------------------------------

  describe("computeFingerprint", () => {
    it("should produce the same fingerprint for identical inputs", () => {
      const fp1 = computeFingerprint({
        documentVersion: 1,
        line: 5,
        character: 10,
        prefix: "hello",
        suffix: "world",
        model: "qwen-coder",
      });
      const fp2 = computeFingerprint({
        documentVersion: 1,
        line: 5,
        character: 10,
        prefix: "hello",
        suffix: "world",
        model: "qwen-coder",
      });
      expect(fp1).toBe(fp2);
    });

    it("should produce different fingerprints for different inputs", () => {
      const fp1 = computeFingerprint({
        documentVersion: 1,
        line: 5,
        character: 10,
        prefix: "hello",
        suffix: "world",
        model: "qwen-coder",
      });
      const fp2 = computeFingerprint({
        documentVersion: 2,
        line: 5,
        character: 10,
        prefix: "hello",
        suffix: "world",
        model: "qwen-coder",
      });
      expect(fp1).not.toBe(fp2);
    });
  });
});
