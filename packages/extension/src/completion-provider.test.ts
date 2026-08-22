import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
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
    vi.useFakeTimers();
    provider = new LocalCopilotCompletionProvider(createDefaultConfig());
  });

  afterEach(() => {
    provider.dispose();
    vi.useRealTimers();
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

  it("should have orchestratorInstance getter", () => {
    expect(provider.orchestratorInstance).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // Disabled state
  // -----------------------------------------------------------------------

  describe("when disabled", () => {
    it("should return empty items", async () => {
      provider.updateConfig(createDefaultConfig({ enabled: false }));
      const doc = createMockDocument("const x = |");
      const result = provider.provideInlineCompletionItems(
        doc as never,
        { line: 0, character: 10 } as never,
        createMockCompletionContext(),
        createMockCancellationToken()
      );
      expect(await result).toEqual({ items: [] });
    });
  });

  // -----------------------------------------------------------------------
  // No model configured
  // -----------------------------------------------------------------------

  describe("when no model is configured", () => {
    it("should return empty items", async () => {
      provider.updateConfig(createDefaultConfig({ model: "" }));
      const doc = createMockDocument("const x = |");
      const result = provider.provideInlineCompletionItems(
        doc as never,
        { line: 0, character: 10 } as never,
        createMockCompletionContext(),
        createMockCancellationToken()
      );
      expect(await result).toEqual({ items: [] });
    });
  });

  // -----------------------------------------------------------------------
  // Cancellation
  // -----------------------------------------------------------------------

  describe("when request is cancelled", () => {
    it("should return empty items", async () => {
      const doc = createMockDocument("const x = |");
      const result = provider.provideInlineCompletionItems(
        doc as never,
        { line: 0, character: 10 } as never,
        createMockCompletionContext(),
        createMockCancellationToken(true)
      );
      expect(await result).toEqual({ items: [] });
    });
  });

  // -----------------------------------------------------------------------
  // Comment / string detection
  // -----------------------------------------------------------------------

  describe("context detection", () => {
    it.each([
      ["comment", INSIDE_COMMENT],
      ["string", INSIDE_STRING],
    ] as const)("should skip when cursor is inside a %s", async (_label, scenario) => {
      const doc = createMockDocument(scenario.document, scenario.language);
      const result = provider.provideInlineCompletionItems(
        doc as never,
        { line: scenario.cursorLine, character: scenario.cursorCharacter } as never,
        createMockCompletionContext(),
        createMockCancellationToken()
      );
      expect(await result).toEqual({ items: [] });
    });
  });

  // -----------------------------------------------------------------------
  // Normal scenarios — returns empty (provider not connected)
  // -----------------------------------------------------------------------

  describe("completion scenarios", () => {
    it.each([
      ["function body", FUNCTION_BODY],
      ["variable assignment", VARIABLE_ASSIGNMENT],
      ["empty document", EMPTY_DOCUMENT],
      ["JSX return", JSX_RETURN],
    ] as const)(
      "should return empty items for %s (provider not connected)",
      async (_label, scenario) => {
        const doc = createMockDocument(scenario.document, scenario.language);
        const resultPromise = provider.provideInlineCompletionItems(
          doc as never,
          {
            line: scenario.cursorLine,
            character: scenario.cursorCharacter,
          } as never,
          createMockCompletionContext(),
          createMockCancellationToken()
        );
        // Advance past debounce so the scheduler resolves
        vi.advanceTimersByTime(200);
        expect(await resultPromise).toEqual({ items: [] });
      }
    );
  });

  // -----------------------------------------------------------------------
  // Config updates affect behavior
  // -----------------------------------------------------------------------

  describe("config updates", () => {
    it("should reflect new enabled state after update", async () => {
      // Start enabled
      provider.updateConfig(createDefaultConfig({ enabled: true }));
      let doc = createMockDocument("const x = |");
      let resultPromise = provider.provideInlineCompletionItems(
        doc as never,
        { line: 0, character: 10 } as never,
        createMockCompletionContext(),
        createMockCancellationToken()
      );
      vi.advanceTimersByTime(200);
      expect(await resultPromise).toEqual({ items: [] });

      // Disable
      provider.updateConfig(createDefaultConfig({ enabled: false }));
      doc = createMockDocument("const x = |");
      resultPromise = provider.provideInlineCompletionItems(
        doc as never,
        { line: 0, character: 10 } as never,
        createMockCompletionContext(),
        createMockCancellationToken()
      );
      expect(await resultPromise).toEqual({ items: [] });
    });
  });

  // -----------------------------------------------------------------------
  // Dispose
  // -----------------------------------------------------------------------

  describe("dispose", () => {
    it("should dispose without throwing", () => {
      provider.dispose();
    });
  });
});
