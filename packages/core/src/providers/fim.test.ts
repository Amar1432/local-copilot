import { describe, it, expect } from "vitest";
import {
  formatFimPrompt,
  getFimTokens,
  isFimSupported,
  FIM_TEMPLATES,
} from "./fim";

describe("FIM Support & Formatting", () => {
  describe("getFimTokens", () => {
    it("should return default tokens when no model is provided", () => {
      expect(getFimTokens()).toEqual(FIM_TEMPLATES.default);
    });

    it("should resolve known model families to appropriate FIM tokens", () => {
      expect(getFimTokens("qwen-coder:7b")).toEqual(FIM_TEMPLATES.qwen);
      expect(getFimTokens("deepseek-coder-6.7b")).toEqual(FIM_TEMPLATES.deepseek);
      expect(getFimTokens("starcoder2-3b")).toEqual(FIM_TEMPLATES.starcoder);
      expect(getFimTokens("codellama-7b-instruct")).toEqual(FIM_TEMPLATES.codellama);
    });

    it("should resolve explicit template names", () => {
      expect(getFimTokens("qwen")).toEqual(FIM_TEMPLATES.qwen);
      expect(getFimTokens("deepseek")).toEqual(FIM_TEMPLATES.deepseek);
      expect(getFimTokens("starcoder")).toEqual(FIM_TEMPLATES.starcoder);
    });
  });

  describe("formatFimPrompt", () => {
    it("should format prompt using default tokens", () => {
      const prompt = formatFimPrompt("const x = ", ";", "default");
      expect(prompt).toBe("<PRE>const x = <SUF>;<MID>");
    });

    it("should format prompt using Qwen tokens", () => {
      const prompt = formatFimPrompt("function hello() {\n  ", "\n}", "qwen-2.5-coder");
      expect(prompt).toBe(
        "<|fim_prefix|>function hello() {\n  <|fim_suffix|>\n}<|fim_middle|>"
      );
    });

    it("should format prompt using DeepSeek tokens", () => {
      const prompt = formatFimPrompt("let count = ", ";", "deepseek-coder");
      expect(prompt).toBe("<｜fim begin｜>let count = <｜fim hole｜>;<｜fim end｜>");
    });

    it("should accept custom FimTokens object", () => {
      const customTokens = {
        prefix: "[PRE]",
        suffix: "[SUF]",
        middle: "[MID]",
      };
      const prompt = formatFimPrompt("a + ", "b", customTokens);
      expect(prompt).toBe("[PRE]a + [SUF]b[MID]");
    });
  });

  describe("isFimSupported", () => {
    it("should return true when capabilities explicitly enable fim", () => {
      expect(isFimSupported("unknown-model", { fim: true })).toBe(true);
    });

    it("should return false when capabilities explicitly disable fim", () => {
      expect(isFimSupported("qwen-coder", { fim: false })).toBe(false);
    });

    it("should auto-detect FIM support from model name", () => {
      expect(isFimSupported("qwen-coder:7b")).toBe(true);
      expect(isFimSupported("deepseek-coder")).toBe(true);
      expect(isFimSupported("starcoder")).toBe(true);
      expect(isFimSupported("codellama")).toBe(true);
      expect(isFimSupported("gpt-4o")).toBe(false);
      expect(isFimSupported("claude-3-5-sonnet")).toBe(false);
    });
  });
});
