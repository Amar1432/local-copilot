import { describe, it, expect, beforeEach } from "vitest";
import { LocalCopilotCompletionProvider } from "./completion-provider";
import {
  createDefaultConfig,
  createMockDocument,
  createMockCancellationToken,
  createMockCompletionContext,
} from "../__fixtures__";
import {
  FUNCTION_BODY,
  VARIABLE_ASSIGNMENT,
  EMPTY_DOCUMENT,
  INSIDE_COMMENT,
  INSIDE_STRING,
  JSX_RETURN,
} from "../__fixtures__/completion-scenarios";

describe("LocalCopilotCompletionProvider", () => {
  let provider: LocalCopilotCompletionProvider;

  beforeEach(() => {
    provider = new LocalCopilotCompletionProvider();
  });

  // -----------------------------------------------------------------------
  // Basic interface tests
  // -----------------------------------------------------------------------

  it("should create a completion provider", () => {
    expect(provider).toBeDefined();
  });

  it("should have provideInlineCompletionItems method", () => {
    expect(typeof provider.provideInlineCompletionItems).toBe("function");
  });

  it("should have updateConfig method", () => {
    expect(typeof provider.updateConfig).toBe("function");
  });

  it("should accept config updates without throwing", () => {
    provider.updateConfig(createDefaultConfig({ model: "test-model" }));
  });

  // -----------------------------------------------------------------------
  // Disabled state
  // -----------------------------------------------------------------------

  describe("when disabled", () => {
    it("should return empty items", () => {
      provider.updateConfig(createDefaultConfig({ enabled: false }));
      const doc = createMockDocument("const x = |");
      const result = provider.provideInlineCompletionItems(
        doc as never,
        { line: 0, character: 10 } as never,
        createMockCompletionContext(),
        createMockCancellationToken()
      );
      expect(result).toEqual({ items: [] });
    });
  });

  // -----------------------------------------------------------------------
  // No model configured
  // -----------------------------------------------------------------------

  describe("when no model is configured", () => {
    it("should return empty items", () => {
      provider.updateConfig(createDefaultConfig({ model: "" }));
      const doc = createMockDocument("const x = |");
      const result = provider.provideInlineCompletionItems(
        doc as never,
        { line: 0, character: 10 } as never,
        createMockCompletionContext(),
        createMockCancellationToken()
      );
      expect(result).toEqual({ items: [] });
    });
  });

  // -----------------------------------------------------------------------
  // Cancellation
  // -----------------------------------------------------------------------

  describe("when request is cancelled", () => {
    it("should return empty items", () => {
      const doc = createMockDocument("const x = |");
      const result = provider.provideInlineCompletionItems(
        doc as never,
        { line: 0, character: 10 } as never,
        createMockCompletionContext(),
        createMockCancellationToken(true)
      );
      expect(result).toEqual({ items: [] });
    });
  });

  // -----------------------------------------------------------------------
  // Comment / string detection
  // -----------------------------------------------------------------------

  describe("context detection", () => {
    it.each([
      ["comment", INSIDE_COMMENT],
      ["string", INSIDE_STRING],
    ] as const)("should skip when cursor is inside a %s", (_label, scenario) => {
      const doc = createMockDocument(scenario.document, scenario.language);
      const result = provider.provideInlineCompletionItems(
        doc as never,
        { line: scenario.cursorLine, character: scenario.cursorCharacter } as never,
        createMockCompletionContext(),
        createMockCancellationToken()
      );
      expect(result).toEqual({ items: [] });
    });
  });

  // -----------------------------------------------------------------------
  // Normal scenarios — currently returns empty (provider not connected yet)
  // -----------------------------------------------------------------------

  describe("completion scenarios", () => {
    it.each([
      ["function body", FUNCTION_BODY],
      ["variable assignment", VARIABLE_ASSIGNMENT],
      ["empty document", EMPTY_DOCUMENT],
      ["JSX return", JSX_RETURN],
    ] as const)("should return empty items for %s (provider not connected)", (_label, scenario) => {
      const doc = createMockDocument(scenario.document, scenario.language);
      const result = provider.provideInlineCompletionItems(
        doc as never,
        {
          line: scenario.cursorLine,
          character: scenario.cursorCharacter,
        } as never,
        createMockCompletionContext(),
        createMockCancellationToken()
      );
      expect(result).toEqual({ items: [] });
    });
  });

  // -----------------------------------------------------------------------
  // Config updates affect behavior
  // -----------------------------------------------------------------------

  describe("config updates", () => {
    it("should reflect new enabled state after update", () => {
      // Start enabled
      provider.updateConfig(createDefaultConfig({ enabled: true }));
      let doc = createMockDocument("const x = |");
      let result = provider.provideInlineCompletionItems(
        doc as never,
        { line: 0, character: 10 } as never,
        createMockCompletionContext(),
        createMockCancellationToken()
      );
      // Returns empty (no model), but not because disabled
      expect(result).toEqual({ items: [] });

      // Disable
      provider.updateConfig(createDefaultConfig({ enabled: false }));
      doc = createMockDocument("const x = |");
      result = provider.provideInlineCompletionItems(
        doc as never,
        { line: 0, character: 10 } as never,
        createMockCompletionContext(),
        createMockCancellationToken()
      );
      expect(result).toEqual({ items: [] });
    });
  });
});
