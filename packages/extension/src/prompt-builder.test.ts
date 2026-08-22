import { describe, it, expect } from "vitest";
import { buildStandardMessages, buildFIMPrompt } from "./prompt-builder";
import type { CompletionRequest } from "@local-copilot/shared";

function createRequest(overrides: Partial<CompletionRequest> = {}): CompletionRequest {
  return {
    documentUri: "file:///test.ts",
    documentVersion: 1,
    language: "typescript",
    prefix: "function hello() {\n  ",
    suffix: "\n}",
    position: { line: 1, character: 2 },
    ...overrides,
  };
}

describe("prompt-builder", () => {
  // -----------------------------------------------------------------------
  // buildStandardMessages
  // -----------------------------------------------------------------------

  describe("buildStandardMessages", () => {
    it("should return system + user messages", () => {
      const messages = buildStandardMessages(createRequest());
      expect(messages).toHaveLength(2);
      expect(messages[0].role).toBe("system");
      expect(messages[1].role).toBe("user");
    });

    it("should include the language in the system prompt", () => {
      const messages = buildStandardMessages(createRequest({ language: "python" }));
      expect(messages[0].content).toContain("python");
    });

    it("should include PREFIX tag in user content", () => {
      const messages = buildStandardMessages(createRequest());
      expect(messages[1].content).toContain("<PREFIX>");
      expect(messages[1].content).toContain("</PREFIX>");
    });

    it("should include SUFFIX tag in user content", () => {
      const messages = buildStandardMessages(createRequest());
      expect(messages[1].content).toContain("<SUFFIX>");
      expect(messages[1].content).toContain("</SUFFIX>");
    });

    it("should include COMPLETION tag in user content", () => {
      const messages = buildStandardMessages(createRequest());
      expect(messages[1].content).toContain("<COMPLETION>");
    });

    it("should handle empty prefix", () => {
      const messages = buildStandardMessages(createRequest({ prefix: "" }));
      expect(messages[1].content).not.toContain("<PREFIX>");
    });

    it("should handle empty suffix", () => {
      const messages = buildStandardMessages(createRequest({ suffix: "" }));
      expect(messages[1].content).not.toContain("<SUFFIX>");
    });

    it("should instruct the model not to explain", () => {
      const messages = buildStandardMessages(createRequest());
      expect(messages[0].content).toContain("Do not explain");
    });

    it("should instruct the model not to include markdown fences", () => {
      const messages = buildStandardMessages(createRequest());
      expect(messages[0].content).toContain("markdown fences");
    });
  });

  // -----------------------------------------------------------------------
  // buildFIMPrompt
  // -----------------------------------------------------------------------

  describe("buildFIMPrompt", () => {
    it("should include PRE, SUF, and MID tokens", () => {
      const prompt = buildFIMPrompt(createRequest());
      expect(prompt).toContain("<PRE>");
      expect(prompt).toContain("<SUF>");
      expect(prompt).toContain("<MID>");
    });

    it("should place prefix after PRE token", () => {
      const prompt = buildFIMPrompt(createRequest());
      const preIndex = prompt.indexOf("<PRE>");
      const sufIndex = prompt.indexOf("<SUF>");
      const prefixText = createRequest().prefix;
      expect(preIndex).toBeLessThan(sufIndex);
      expect(prompt).toContain(prefixText);
    });

    it("should place suffix between SUF and MID tokens", () => {
      const prompt = buildFIMPrompt(createRequest());
      const sufIndex = prompt.indexOf("<SUF>");
      const midIndex = prompt.indexOf("<MID>");
      const suffixText = createRequest().suffix;
      expect(sufIndex).toBeLessThan(midIndex);
      expect(prompt).toContain(suffixText);
    });

    it("should handle empty prefix", () => {
      const prompt = buildFIMPrompt(createRequest({ prefix: "" }));
      expect(prompt).toContain("<PRE>");
      expect(prompt).toContain("<SUF>");
      expect(prompt).toContain("<MID>");
    });

    it("should handle empty suffix", () => {
      const prompt = buildFIMPrompt(createRequest({ suffix: "" }));
      expect(prompt).toContain("<PRE>");
      expect(prompt).toContain("<SUF>");
      expect(prompt).toContain("<MID>");
    });
  });
});
