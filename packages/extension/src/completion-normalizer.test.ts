import { describe, it, expect } from "vitest";
import { normalizeCompletion } from "./completion-normalizer";

describe("completion-normalizer", () => {
  // -----------------------------------------------------------------------
  // Basic normalization
  // -----------------------------------------------------------------------

  describe("normalizeCompletion", () => {
    it("should return null for empty input", () => {
      expect(normalizeCompletion("", "", "")).toBeNull();
    });

    it("should return null for whitespace-only input", () => {
      expect(normalizeCompletion("   \n  \n  ", "", "")).toBeNull();
    });

    it("should return clean code as-is", () => {
      expect(normalizeCompletion('console.log("hello");', "", "")).toBe('console.log("hello");');
    });

    // -----------------------------------------------------------------------
    // Code fence removal
    // -----------------------------------------------------------------------

    describe("code fence removal", () => {
      it("should remove opening and closing code fences", () => {
        const input = '```typescript\nconsole.log("hello");\n```';
        expect(normalizeCompletion(input, "", "")).toBe('console.log("hello");');
      });

      it("should remove fences without language tag", () => {
        const input = "```\nconst x = 1;\n```";
        expect(normalizeCompletion(input, "", "")).toBe("const x = 1;");
      });

      it("should handle fences with extra whitespace", () => {
        const input = "```  \nconst x = 1;\n```  ";
        expect(normalizeCompletion(input, "", "")).toBe("const x = 1;");
      });
    });

    // -----------------------------------------------------------------------
    // Prompt label removal
    // -----------------------------------------------------------------------

    describe("prompt label removal", () => {
      it("should remove PREFIX/SUFFIX/COMPLETION tags", () => {
        const input = "<PREFIX>\nconst x = 1;</PREFIX>\n<COMPLETION>";
        expect(normalizeCompletion(input, "", "")).toBe("const x = 1;");
      });

      it("should remove PRE/SUF/MID tokens", () => {
        const input = "<PRE> const x = 1; <SUF> <MID>";
        expect(normalizeCompletion(input, "", "")).toBe("const x = 1;");
      });
    });

    // -----------------------------------------------------------------------
    // Duplicate prefix removal
    // -----------------------------------------------------------------------

    describe("duplicate prefix removal", () => {
      it("should remove duplicate prefix from output", () => {
        const prefix = "function hello() {\n  ";
        const output = '  console.log("world");';
        const result = normalizeCompletion(output, prefix, "");
        expect(result).toBe('console.log("world");');
      });

      it("should not remove non-matching prefix", () => {
        const prefix = "function hello() {\n  ";
        const output = "const x = 1;";
        const result = normalizeCompletion(output, prefix, "");
        expect(result).toBe("const x = 1;");
      });
    });

    // -----------------------------------------------------------------------
    // Duplicate suffix removal
    // -----------------------------------------------------------------------

    describe("duplicate suffix removal", () => {
      it("should remove duplicate suffix from output", () => {
        const suffix = "\n}";
        const output = '  console.log("world");\n}';
        const result = normalizeCompletion(output, "", suffix);
        expect(result).toBe('console.log("world");');
      });
    });

    // -----------------------------------------------------------------------
    // Prose detection
    // -----------------------------------------------------------------------

    describe("prose detection", () => {
      it("should discard explanatory prose", () => {
        const input = [
          "Here's how you can log a message:",
          "You should use console.log",
          "This will output the message to the console",
        ].join("\n");
        expect(normalizeCompletion(input, "", "")).toBeNull();
      });

      it("should keep code that happens to contain common words", () => {
        const input = 'console.log("here is the output");';
        expect(normalizeCompletion(input, "", "")).toBe(input);
      });
    });

    // -----------------------------------------------------------------------
    // Combined cleanup
    // -----------------------------------------------------------------------

    describe("combined cleanup", () => {
      it("should handle all cleanup steps together", () => {
        const input = "```typescript\n<PREFIX>\nconst x = 1;</PREFIX>\n<COMPLETION>\n```";
        const result = normalizeCompletion(input, "", "");
        expect(result).toBe("const x = 1;");
      });
    });
  });
});
