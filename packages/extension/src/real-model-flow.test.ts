/**
 * REAL-MODEL integration test — only runs when PRIVATE_COPILOT_INTEGRATION=1
 * and an Ollama endpoint with qwen2.5-coder:7b is reachable.
 *
 * Simulates the exact VS Code lifecycle through the extension's REAL code
 * path (context-engine → openai-provider → normalizer):
 *
 *   1. User types `getU`            → model suggests a completion
 *   2. User accepts                 → cursor moves, document version bumps
 *   3. VS Code re-triggers         → model asked to continue from new state
 *
 * The invariant under test: the second suggestion must NOT repeat the
 * just-accepted suggestion.
 *
 * Run with:
 *   PRIVATE_COPILOT_INTEGRATION=1 npx vitest run src/real-model-flow.test.ts
 */
import { describe, it, expect } from "vitest";
import { complete } from "./openai-provider";
import { normalizeCompletion } from "./completion-normalizer";
import { buildCompletionRequest } from "./context-engine";

const CONFIG = {
  enabled: true,
  provider: "ollama",
  baseUrl: "http://localhost:11434/v1",
  apiKey: "",
  model: "qwen2.5-coder:7b",
  debounceMs: 150,
  requestTimeoutMs: 20000,
  maxOutputTokens: 64,
  temperature: 0.1,
  contextMaxLines: 120,
  localOnly: true,
  telemetryEnabled: false,
};

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

function currentLineOf(fullText: string, cursorLine: number): string {
  return fullText.split("\n")[cursorLine] ?? "";
}

const enabled = process.env.PRIVATE_COPILOT_INTEGRATION === "1";

describe.skipIf(!enabled)("real model flow (Ollama qwen2.5-coder)", () => {
  it("does not re-suggest the accepted text after acceptance", async () => {
    if (!(await ollamaReady())) {
      console.log("SKIP: Ollama or qwen2.5-coder not reachable");
      return;
    }

    const signal = new AbortController().signal;

    // ---- Step 1: type `getU` -------------------------------------------
    const v1 = {
      fullText: "const user = getUser",
      cursorLine: 0,
      cursorCharacter: 21, // end of `getUser`
      version: 1,
    };
    const req1 = buildCompletionRequest({
      documentUri: "file:///test.ts",
      documentVersion: v1.version,
      language: "typescript",
      fullText: v1.fullText,
      cursorLine: v1.cursorLine,
      cursorCharacter: v1.cursorCharacter,
      maxLines: 120,
    });
    const raw1 = await complete(req1, CONFIG, signal);
    const first = raw1 ? normalizeCompletion(raw1.text, req1.prefix, req1.suffix, currentLineOf(v1.fullText, v1.cursorLine)) : null;
    console.log(`[step1] prefix=${JSON.stringify(req1.prefix)}`);
    console.log(`[step1] model raw: ${JSON.stringify(raw1?.text)}`);
    console.log(`[step1] normalized: ${JSON.stringify(first)}`);
    expect(first).not.toBeNull();

    // ---- Step 2: accept → cursor moves, version bumps ------------------
    const v2 = {
      fullText: `const user = getUser${first}`,
      cursorLine: 0,
      cursorCharacter: v1.cursorCharacter + (first?.length ?? 0), // end of accepted text
      version: 2,
    };
    const req2 = buildCompletionRequest({
      documentUri: "file:///test.ts",
      documentVersion: v2.version,
      language: "typescript",
      fullText: v2.fullText,
      cursorLine: v2.cursorLine,
      cursorCharacter: v2.cursorCharacter,
      maxLines: 120,
    });
    const raw2 = await complete(req2, CONFIG, signal);
    const second = raw2 ? normalizeCompletion(raw2.text, req2.prefix, req2.suffix, currentLineOf(v2.fullText, v2.cursorLine)) : null;
    console.log(`[step2] doc after accept: ${JSON.stringify(v2.fullText)}`);
    console.log(`[step2] prefix: ${JSON.stringify(req2.prefix)}`);
    console.log(`[step2] model raw: ${JSON.stringify(raw2?.text)}`);
    console.log(`[step2] normalized: ${JSON.stringify(second)}`);

    if (second === null) {
      console.log("[result] no second suggestion — good");
      return;
    }
    console.log(`[result] second suggestion ${second === first ? "REPEATS" : "differs from"} the accepted one`);
    expect(second).not.toBe(first);
  }, 120_000);
});