/**
 * Autocomplete flow tests — simulate the real VS Code lifecycle through the
 * FULL real code path (provider → orchestrator → scheduler → openai-provider →
 * normalizer → duplicate suppression) with a scriptable fake model.
 *
 * The core invariant: the extension must never re-suggest the text the user
 * just accepted (or dismissed), even when the model (like a weak local model)
 * keeps producing it.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { LocalCopilotCompletionProvider } from "./completion-provider";
import { createMockDocument, createMockCancellationToken, createMockCompletionContext } from "../__fixtures__";

// ---------------------------------------------------------------------------
// Scriptable fake model server
// ---------------------------------------------------------------------------

interface FakeModelCall {
  readonly messages: Array<{ readonly role: string; readonly content: string }>;
}

/**
 * Install a fake fetch that answers completion requests using a scriptable
 * model function. The function receives the parsed request body and returns
 * the raw completion text the "model" produced.
 */
function installFakeModel(model: (call: FakeModelCall) => string): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: { body?: string }) => {
      const body = init?.body ? JSON.parse(init.body) : {};
      const output = model({ messages: body.messages ?? [] });
      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: "fake",
          choices: [{ message: { content: output }, finish_reason: "stop" }],
        }),
      };
    })
  );
}

function restoreFetch(): void {
  vi.unstubAllGlobals();
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/**
 * Trigger the provider at a given document state. Mirrors exactly what VS Code
 * does when it asks for an inline completion.
 */
async function trigger(
  provider: LocalCopilotCompletionProvider,
  text: string,
  line: number,
  character: number,
  version: number
): Promise<string | null> {
  const doc = createMockDocument(text, "typescript", "file:///test.ts");
  // createMockDocument hardcodes version 1 — override for realistic versioning
  const docWithVersion = Object.assign(doc, { version });
  const resultPromise = provider.provideInlineCompletionItems(
    docWithVersion as never,
    { line, character } as never,
    createMockCompletionContext(),
    createMockCancellationToken()
  );
  // Advance past the 150ms debounce so the scheduler resolves
  vi.advanceTimersByTime(300);
  const result = (await resultPromise) as { items: Array<{ insertText: string }> };
  return result.items.length > 0 ? result.items[0].insertText : null;
}

// ---------------------------------------------------------------------------
// Fake model behaviors
// ---------------------------------------------------------------------------

/**
 * A realistic weak local model: it echoes the current line back (qwen2.5-coder
 * does exactly this — the raw output included the full `const user = getUser();`
 * line even though the prefix already contained it), then continues.
 */
function echoThenContinueModel(rawSuggestion: string, continuation: string) {
  return (call: FakeModelCall): string => {
    const user = call.messages.find((m) => m.role === "user")?.content ?? "";
    const prefix = extractPrefix(user);
    const line = prefix.split("\n").pop() ?? "";
    if (line.endsWith(rawSuggestion)) {
      return `\`\`\`typescript\n${prefix}${continuation}\n\`\`\``;
    }
    return `\`\`\`typescript\n${line}${rawSuggestion}\n\`\`\``;
  };
}

/** Extract the <PREFIX> section from the standard (non-FIM) prompt. */
function extractPrefix(userContent: string): string {
  const match = userContent.match(/<PREFIX>\n([\s\S]*?)<\/PREFIX>/);
  return match ? match[1] : userContent;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("autocomplete flow — no repeat of the last accepted suggestion", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    restoreFetch();
  });

  it("shows a suggestion while typing, then suppresses the same text after acceptance", async () => {
    // Model behavior: while typing it completes the call; after acceptance it
    // (like a weak local model) re-suggests the same text.
    installFakeModel(echoThenContinueModel("ser()", "ser()"));

    const provider = new LocalCopilotCompletionProvider(createDefaultConfig());

    // Step 1: type `getU` — the model completes it
    const first = await trigger(provider, "const user = getUser", 0, 16, 1);
    expect(first).toBe("ser()");

    // Step 2: user accepts — document now contains `getUser()`, cursor moved,
    // document version bumped, VS Code re-triggers. Model again says `ser()`.
    const second = await trigger(provider, "const user = getUser()", 0, 21, 2);
    // The accepted text must NOT be suggested again.
    expect(second).toBeNull();
  });

  it("does not re-suggest a multi-line block that was just accepted", async () => {
    const BLOCK = [
      "  const total = 0;",
      "  for (const item of items) {",
      "    total += item;",
      "  }",
      "  return total;",
    ].join("\n");

    installFakeModel(() => `\`\`\`typescript\n${BLOCK}\n\`\`\``);

    const provider = new LocalCopilotCompletionProvider(createDefaultConfig());

    // Step 1: cursor inside an empty function body — model suggests the body.
    // The normalizer trims leading whitespace, so compare against trimmed form.
    const first = await trigger(provider, "function compute() {\n|\n}", 1, 0, 1);
    expect(first).toBe(BLOCK.trim());

    // Step 2: accept — cursor now at the end of the block, version bumped.
    const docAfterAccept = `function compute() {\n${BLOCK}\n}`;
    const second = await trigger(provider, docAfterAccept, 5, 14, 2);
    expect(second).toBeNull();
  });

  it("does not re-suggest the accepted text when the user keeps typing on the same line", async () => {
    // After accepting `getUser()`, the user types `;` — the model (still
    // fixated) re-suggests `ser()`. It must not be shown.
    installFakeModel(echoThenContinueModel("ser()", "ser()"));

    const provider = new LocalCopilotCompletionProvider(createDefaultConfig());

    const first = await trigger(provider, "const user = getUser", 0, 16, 1);
    expect(first).toBe("ser()");

    // Accept, then type `;`
    const second = await trigger(provider, "const user = getUser();", 0, 22, 3);
    expect(second).toBeNull();
  });

  it("suppresses a suggestion that duplicates a block from earlier in the file", async () => {
    // Weak local models echo earlier file content (e.g. qwen2.5-coder at
    // end-of-file re-emits the start of the file). The completion must not
    // duplicate a block that already exists anywhere before the cursor.
    // A short (2-line) block that already exists mid-file: too short for the
    // normalizer's multi-line echo strip (>= 4 lines), so it survives
    // normalization and must be caught by the provider's anywhere-before-cursor
    // duplicate check.
    const BLOCK = "    let slow = head;\n    let fast = head.next;";

    const DOC = [
      "// Your code here",
      "// flyodd loop detection",
      "function hasCycle(head: ListNode | null): boolean {",
      "    if (!head || !head.next) return false;",
      "",
      BLOCK,
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

    // The model echoes the exact BLOCK (which already exists mid-file) and the
    // cursor is at the end of the document.
    installFakeModel(() => BLOCK);
    const provider = new LocalCopilotCompletionProvider(createDefaultConfig());

    const lines = DOC.split("\n");
    const lastLine = lines.length - 1;
    const lastChar = lines[lastLine].length;
    const first = await trigger(provider, DOC, lastLine, lastChar, 1);
    expect(first).toBeNull();
  });

  it("suppresses the just-dismissed suggestion when VS Code re-requests the same state", async () => {
    // After the user dismisses (Esc) a suggestion, VS Code can re-request the
    // identical state. The L1 cache would normally serve the exact same
    // suggestion again — the provider must suppress it.
    installFakeModel(() => "ser()");

    const provider = new LocalCopilotCompletionProvider(createDefaultConfig());

    // First request — suggestion shown
    const first = await trigger(provider, "const user = getUser", 0, 16, 1);
    expect(first).toBe("ser()");

    // The user has had time to see and reject the suggestion (Esc). The
    // document state is UNCHANGED (same version, same position) and VS Code
    // re-requests the identical state — the suggestion must stay dismissed.
    vi.advanceTimersByTime(1200);
    const second = await trigger(provider, "const user = getUser", 0, 16, 1);
    expect(second).toBeNull();
  });
});

/**
 * Default config with FIM disabled so the fake model's plain-text output is
 * compared verbatim through the normalizer (FIM formatting is orthogonal).
 */
function createDefaultConfig() {
  return {
    enabled: true,
    provider: "custom",
    baseUrl: "http://localhost:11434/v1",
    apiKey: "",
    model: "qwen-coder",
    debounceMs: 150,
    requestTimeoutMs: 2000,
    maxOutputTokens: 128,
    temperature: 0.1,
    contextMaxLines: 120,
    localOnly: true,
    telemetryEnabled: false,
    useFim: false,
  };
}