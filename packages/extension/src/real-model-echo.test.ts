/**
 * REAL-MODEL reproduction of the duplicate-ghost-text bug (the screenshot:
 * the extension suggested the whole `hasCycle` function that already exists
 * at the top of the file).
 *
 * Drives the FULL real pipeline (provider → orchestrator → scheduler →
 * openai-provider → Ollama qwen2.5-coder → normalizer → suppression) with the
 * cursor at the end of the file, exactly as the user experienced it.
 *
 * Run with:
 *   PRIVATE_COPILOT_INTEGRATION=1 npx vitest run src/real-model-echo.test.ts
 */
import { describe, it, expect } from "vitest";
import { LocalCopilotCompletionProvider } from "./completion-provider";

const DOC = [
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

async function ollamaReady(): Promise<boolean> {
  try {
    const res = await fetch("http://localhost:11434/api/tags", { signal: AbortSignal.timeout(2000) });
    if (!res.ok) return false;
    const data = (await res.json()) as { models?: Array<{ name: string }> };
    return data.models?.some((m) => m.name.startsWith("qwen2.5-coder")) ?? false;
  } catch {
    return false;
  }
}

const enabled = process.env.PRIVATE_COPILOT_INTEGRATION === "1";

function config() {
  return {
    enabled: true,
    provider: "ollama",
    baseUrl: "http://localhost:11434/v1",
    apiKey: "",
    model: "qwen2.5-coder:7b",
    debounceMs: 150,
    requestTimeoutMs: 30000,
    maxOutputTokens: 128,
    temperature: 0.1,
    contextMaxLines: 500,
    localOnly: true,
    telemetryEnabled: false,
  };
}

describe.skipIf(!enabled)("real model echo reproduction (Ollama qwen2.5-coder)", () => {
  it("does not re-suggest a block that already exists earlier in the file", async () => {
    if (!(await ollamaReady())) {
      console.log("SKIP: Ollama or qwen2.5-coder not reachable");
      return;
    }

    const provider = new LocalCopilotCompletionProvider(config());

    const lines = DOC.split("\n");
    const cursorLine = lines.length - 1; // end of file (after class closing brace)
    const cursorCharacter = lines[cursorLine].length;

    const doc = {
      uri: "file:///test.ts",
      languageId: "typescript",
      version: 1,
      lineCount: lines.length,
      getText: (range?: unknown) => {
        if (!range) return DOC;
        const start = range as { start: { line: number; character: number } };
        const end = range as { end: { line: number; character: number } };
        const s = offset(DOC, start.start.line, start.start.character);
        const e = offset(DOC, end.end.line, end.end.character);
        return DOC.slice(s, e);
      },
      lineAt: (line: number) => ({ text: lines[line] ?? "", lineNumber: line }),
    };

    const resultPromise = provider.provideInlineCompletionItems(
      doc as never,
      { line: cursorLine, character: cursorCharacter } as never,
      { triggerKind: 0, selectedCompletionInfo: undefined } as never,
      { isCancellationRequested: false, onCancellationRequested: () => ({ dispose: () => {} }) } as never
    );

    const result = (await resultPromise) as { items: Array<{ insertText: string }> };
    console.log(`[result] items shown: ${result.items.length}`);
    for (const item of result.items) {
      console.log(`[result] insertText FULL: ${JSON.stringify(item.insertText)}`);
    }

    if (result.items.length === 0) {
      console.log("[result] no suggestion — the duplicate was suppressed");
      return;
    }

    const text = result.items[0].insertText;
    const trimmed = text.trim();
    // The bug being tested: the suggestion must not re-emit the start of the
    // file (the screenshot showed `// Your code here\n// flyodd loop
    // detection\nfunction hasCycle...` as ghost text) nor duplicate an entire
    // existing block.
    const reemitsFileStart = trimmed.startsWith("// Your code here");
    const duplicatesExistingBlock = trimmed.length > 0 && DOC.includes(trimmed);
    console.log(`[result] re-emits file start: ${reemitsFileStart}`);
    console.log(`[result] duplicates existing block: ${duplicatesExistingBlock}`);
    expect(reemitsFileStart).toBe(false);
    expect(duplicatesExistingBlock).toBe(false);
  }, 120_000);
});

function offset(text: string, line: number, character: number): number {
  const ls = text.split("\n");
  let off = 0;
  for (let i = 0; i < line && i < ls.length; i++) {
    off += ls[i].length + 1;
  }
  return off + Math.min(character, ls[line]?.length ?? 0);
}