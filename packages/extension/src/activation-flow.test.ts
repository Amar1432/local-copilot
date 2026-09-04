/**
 * Activation flow test — verifies that a freshly activated extension:
 *
 *   1. Produces inline completions immediately (no hidden connection gate).
 *   2. Auto-checks the provider connection at startup, so the user never has
 *      to manually run "Test Connection" before the extension "boots".
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as vscode from "vscode";
import { activate } from "./extension";
import { resetMocks, spy, mockConfig } from "../__mocks__/vscode";

describe("activation flow — no manual test connection needed", () => {
  let mockContext: { subscriptions: Array<{ dispose: () => void }>; secrets: typeof spy.secrets };

  beforeEach(() => {
    resetMocks();
    mockContext = { subscriptions: [], secrets: spy.secrets };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("registers the provider and produces a completion without any manual test", async () => {
    // Stub the model server BEFORE activation: the auto-connect check issues a
    // GET /models, and the completion request issues a POST /chat/completions.
    const fetchStub = vi.fn(
      async (url: string, init?: { method?: string }) => {
        const isCompletion = (init?.method ?? "GET") === "POST";
        return {
          ok: true,
          status: 200,
          json: async () =>
            isCompletion
              ? {
                  id: "fake",
                  choices: [{ message: { content: "ser()" }, finish_reason: "stop" }],
                }
              : { models: [{ id: "qwen2.5-coder:7b" }] },
        };
      }
    );
    vi.stubGlobal("fetch", fetchStub);

    await activate(mockContext as unknown as vscode.ExtensionContext);

    // The inline completion provider must be registered on activation
    expect(spy.inlineCompletionProviders).toHaveLength(1);
    const inlineProvider = spy.inlineCompletionProviders[0]
      .provider as unknown as {
      provideInlineCompletionItems: (...args: unknown[]) => Promise<unknown>;
    };

    const doc = {
      uri: "file:///test.ts",
      languageId: "typescript",
      version: 1,
      lineCount: 1,
      getText: () => "const user = getUser",
      lineAt: () => ({ text: "const user = getUser", lineNumber: 0 }),
    };

    const resultPromise = inlineProvider.provideInlineCompletionItems(
      doc as never,
      { line: 0, character: 16 } as never,
      { triggerKind: 0, selectedCompletionInfo: undefined } as never,
      { isCancellationRequested: false, onCancellationRequested: () => ({ dispose: () => {} }) } as never
    );

    const result = (await resultPromise) as { items: Array<{ insertText: string }> };
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items[0].insertText).toBe("ser()");

    // Exactly one completion POST; the other call(s) are the auto-connect GET.
    const completionCalls = fetchStub.mock.calls.filter(
      ([, init]) => (init as { method?: string } | undefined)?.method === "POST"
    );
    expect(completionCalls).toHaveLength(1);
  });

  it("auto-initializes the connection state on activation (no manual test needed)", async () => {
    mockConfig.model = "qwen2.5-coder:7b";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ models: [{ id: "qwen2.5-coder:7b" }] }),
      }))
    );

    await activate(mockContext as unknown as vscode.ExtensionContext);

    const orchestrator = (
      spy.inlineCompletionProviders[0].provider as unknown as {
        orchestratorInstance: { connectionState: string };
      }
    ).orchestratorInstance;

    // Give the fire-and-forget auto-connect check a moment to complete
    await new Promise((r) => setTimeout(r, 100));
    expect(orchestrator.connectionState).toBe("connected");
  });
});