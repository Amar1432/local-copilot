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

    // -----------------------------------------------------------------------
    // Multi-line prefix echo removal
    // -----------------------------------------------------------------------

    describe("multi-line prefix echo removal", () => {
      it("strips a multi-line echo of the prefix and keeps the continuation", () => {
        const prefix = "function f() {\n  return 1;\n}\n";
        const output = "function f() {\n  return 1;\n}\n\nconst x = 2;";
        expect(normalizeCompletion(output, prefix, "")).toBe("const x = 2;");
      });

      it("returns null when the output is entirely a duplicate of the prefix", () => {
        const prefix = "function f() {\n  return 1;\n}\n";
        const output = "function f() {\n  return 1;\n}\n";
        expect(normalizeCompletion(output, prefix, "")).toBeNull();
      });

      it("does not strip legitimate completions", () => {
        const prefix = "function f() {\n";
        const output = "  return 1;\n}";
        expect(normalizeCompletion(output, prefix, "")).toBe("return 1;\n}");
      });

      it("strips an echo of an earlier file block (cursor at end of file)", () => {
        // Model re-emits the start of the file before continuing (the reported
        // bug: qwen2.5-coder at end-of-file echoes the file beginning).
        const prefix = [
          "// Your code here",
          "// flyodd loop detection",
          "function hasCycle(head: ListNode | null): boolean {",
          "    if (!head || !head.next) return false;",
          "",
          "    let slow = head;",
          "    let fast = head.next;",
          "",
          "    while (fast && fast.next) {",
          "        if (slow === fast) return true;",
          "        slow = slow.next!;",
          "        fast = fast.next.next!;",
          "    }",
          "",
          "    return false;",
          "}",
          "",
          "class ListNode {",
          "    val: number;",
          "    next: ListNode | null;",
          "    constructor(val?: number, next?: ListNode | null) {",
          "        this.val = (val === undefined ? 0 : val);",
          "        this.next = (next === undefined ? null : next);",
          "    }",
          "}",
        ].join("\n");
        const echo = [
          "// Your code here",
          "// flyodd loop detection",
          "function hasCycle(head: ListNode | null): boolean {",
          "    if (!head || !head.next) return false;",
          "",
          "    let slow = head;",
          "    let fast = head.next;",
          "",
          "    while (fast && fast.next) {",
          "        if (slow === fast) return true;",
          "        slow = slow.next!;",
          "        fast = fast.next.next!;",
          "    }",
          "",
          "    return false;",
          "}",
        ].join("\n");
        const output = `${echo}\n\nconst newFeature = true;`;
        expect(normalizeCompletion(output, prefix, "")).toBe("const newFeature = true;");
      });
    });

    // -----------------------------------------------------------------------
    // Duplicate current-line removal
    // -----------------------------------------------------------------------

    describe("duplicate current-line removal", () => {
      it("should remove output that ends with the current line content", () => {
        // After accepting "  return sum;" cursor moved past it.
        // Model re-suggests with a leading newline: "\n  return sum;"
        const currentLine = "  return sum;";
        const output = "\n  return sum;";
        const result = normalizeCompletion(output, "", "", currentLine);
        expect(result).toBeNull();
      });

      it("should remove output that starts with the current line content", () => {
        // Model re-generates the entire current line
        const currentLine = "  return sum;";
        const output = "  return sum;\n";
        const result = normalizeCompletion(output, "", "", currentLine);
        expect(result).toBeNull();
      });

      it("should keep output that is different from the current line", () => {
        const currentLine = "  return sum;";
        const output = "  return x + y;";
        const result = normalizeCompletion(output, "", "", currentLine);
        // Leading whitespace is trimmed by the normalizer's final .trim()
        expect(result).toBe("return x + y;");
      });

      it("should keep output when currentLine is empty", () => {
        const currentLine = "";
        const output = "  return sum;";
        const result = normalizeCompletion(output, "", "", currentLine);
        // Leading whitespace is trimmed by the normalizer's final .trim()
        expect(result).toBe("return sum;");
      });

      it("should not crash when currentLine is undefined (backward compat)", () => {
        const output = "  return sum;";
        const result = normalizeCompletion(output, "", "");
        // Leading whitespace is trimmed by the normalizer's final .trim()
        expect(result).toBe("return sum;");
      });

      it("should strip current-line duplicate even with surrounding newlines", () => {
        const currentLine = "    let sum = 0;";
        const output = "\n    let sum = 0;\n";
        const result = normalizeCompletion(output, "", "", currentLine);
        expect(result).toBeNull();
      });

      it("should suppress output that duplicates preceding lines in prefix", () => {
        const prefix = "function f() {\n  return false;\n}";
        const output = "return false;\n}";
        const result = normalizeCompletion(output, prefix, "");
        expect(result).toBeNull();
      });
    });
  });
});
