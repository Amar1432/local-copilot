import { describe, expect, it } from "vitest";
import {
  DEFAULT_RECENT_FILES_OPTIONS,
  RecentFilesBuffer,
  RecentFilesProvider,
  combineScores,
  computeLexicalRelevance,
  computeRecencyScore,
  extractIdentifierTokens,
  extractTopLevelSymbols,
  normalizeLanguageId,
} from "./recent-files-provider";
import { ContextPriority, type ContextBudget, type ContextTarget } from "./context.types";

describe("RecentFilesBuffer", () => {
  it("should track documents with recency timestamps in most-recent-first order", () => {
    let clock = 1000;
    const buffer = new RecentFilesBuffer(5, () => clock);

    buffer.record({ uri: "file:///a.ts", language: "typescript", text: "const a = 1;" });
    clock = 2000;
    buffer.record({ uri: "file:///b.ts", language: "typescript", text: "const b = 2;" });
    clock = 3000;
    buffer.record({ uri: "file:///c.ts", language: "typescript", text: "const c = 3;" });

    expect(buffer.size).toBe(3);
    const listed = buffer.list();
    expect(listed.map((e) => e.uri)).toEqual([
      "file:///c.ts",
      "file:///b.ts",
      "file:///a.ts",
    ]);
    expect(listed[0].lastActiveAt).toBe(3000);
    expect(listed[2].lastActiveAt).toBe(1000);
  });

  it("should move re-recorded documents to most-recent position with updated timestamp", () => {
    let clock = 1000;
    const buffer = new RecentFilesBuffer(5, () => clock);

    buffer.record({ uri: "file:///a.ts", language: "typescript", text: "a" });
    clock = 2000;
    buffer.record({ uri: "file:///b.ts", language: "typescript", text: "b" });
    clock = 3000;
    buffer.record({ uri: "file:///a.ts", language: "typescript", text: "a updated" });

    const listed = buffer.list();
    expect(listed.map((e) => e.uri)).toEqual(["file:///a.ts", "file:///b.ts"]);
    expect(listed[0].lastActiveAt).toBe(3000);
    expect(listed[0].text).toBe("a updated");
  });

  it("should evict least-recently-used entries when maxEntries is exceeded", () => {
    const buffer = new RecentFilesBuffer(2);

    buffer.record({ uri: "file:///a.ts", language: "typescript", text: "a" });
    buffer.record({ uri: "file:///b.ts", language: "typescript", text: "b" });
    buffer.record({ uri: "file:///c.ts", language: "typescript", text: "c" });

    expect(buffer.size).toBe(2);
    expect(buffer.get("file:///a.ts")).toBeUndefined();
    expect(buffer.get("file:///b.ts")).toBeDefined();
    expect(buffer.get("file:///c.ts")).toBeDefined();
  });

  it("should remove and clear entries", () => {
    const buffer = new RecentFilesBuffer(5);

    buffer.record({ uri: "file:///a.ts", language: "typescript", text: "a" });
    expect(buffer.remove("file:///a.ts")).toBe(true);
    expect(buffer.remove("file:///missing.ts")).toBe(false);
    expect(buffer.size).toBe(0);

    buffer.record({ uri: "file:///b.ts", language: "typescript", text: "b" });
    buffer.clear();
    expect(buffer.size).toBe(0);
  });
});

describe("recent-files scoring helpers", () => {
  it("should normalize language identifiers", () => {
    expect(normalizeLanguageId("typescriptreact")).toBe("typescript");
    expect(normalizeLanguageId("javascriptreact")).toBe("javascript");
    expect(normalizeLanguageId("Python")).toBe("python");
    expect(normalizeLanguageId("golang")).toBe("go");
  });

  it("should extract identifier tokens of length >= 3", () => {
    const tokens = extractIdentifierTokens("const getUserById = (id) => user.name;");
    expect(tokens.has("getUserById")).toBe(true);
    expect(tokens.has("user")).toBe(true);
    expect(tokens.has("name")).toBe(true);
    expect(tokens.has("id")).toBe(false);
    expect(tokens.has("const")).toBe(true);
  });

  it("should score lexical relevance by token overlap", () => {
    const target = "fetchUserProfile(userId) returns UserProfile via axios";
    const related = "export function fetchUserProfile(userId: string): UserProfile { axios }";
    const unrelated = "def process_payment(order): return charge(order.total)";

    const relatedScore = computeLexicalRelevance(target, related);
    const unrelatedScore = computeLexicalRelevance(target, unrelated);

    expect(relatedScore).toBeGreaterThan(unrelatedScore);
    expect(computeLexicalRelevance("", related)).toBe(0);
  });

  it("should decay recency scores by LRU position", () => {
    expect(computeRecencyScore(0)).toBe(100);
    expect(computeRecencyScore(1)).toBe(90);
    expect(computeRecencyScore(10)).toBe(0);
    expect(computeRecencyScore(20)).toBe(0);
  });

  it("should blend recency and lexical scores using the configured weight", () => {
    expect(combineScores(100, 0, 0.5)).toBe(50);
    expect(combineScores(100, 50, 1)).toBe(100);
    expect(combineScores(100, 50, 0)).toBe(50);
  });
});

describe("extractTopLevelSymbols", () => {
  it("should extract top-level symbols across languages up to maxCount", () => {
    const lines = [
      "export class UserService {",
      "  async getUser(id: string) {",
      "    return id;",
      "  }",
      "}",
      "",
      "export interface UserRepo {",
      "  find(id: string): unknown;",
      "}",
      "",
      "export function helper() {",
      "  return 42;",
      "}",
      "",
      "export type Alias = string;",
    ];

    const symbols = extractTopLevelSymbols(lines, 10);
    const names = symbols.map((s) => s.symbolName);
    expect(names).toContain("UserService");
    expect(names).toContain("UserRepo");
    expect(names).toContain("helper");
    expect(names).toContain("Alias");
    expect(symbols[0].range.startLine).toBe(1);
    expect(symbols[0].range.endLine).toBe(5);
  });

  it("should limit symbol body length to the configured line cap", () => {
    const lines = [
      "export function big() {",
      ...Array.from({ length: 30 }, (_, i) => `  step${i};`),
      "}",
    ];
    const symbols = extractTopLevelSymbols(lines, 1);
    expect(symbols).toHaveLength(1);
    expect(symbols[0].content.split("\n").length).toBeLessThanOrEqual(
      DEFAULT_RECENT_FILES_OPTIONS.maxLinesPerSymbol
    );
  });
});

describe("RecentFilesProvider", () => {
  const relatedFile = [
    "import axios from 'axios';",
    "",
    "export interface UserProfile {",
    "  id: string;",
    "  name: string;",
    "}",
    "",
    "export function fetchUserProfile(userId: string): Promise<UserProfile> {",
    "  return axios.get('/api/users/' + userId);",
    "}",
  ].join("\n");

  const unrelatedFile = [
    "def process_payment(order):",
    "    total = order.total",
    "    return charge(total)",
  ].join("\n");

  const makeTarget = (overrides: Partial<ContextTarget> = {}): ContextTarget => ({
    documentUri: "file:///src/active.ts",
    documentVersion: 1,
    language: "typescript",
    position: { line: 5, character: 0 },
    prefix:
      "import axios from 'axios';\n\nexport async function loadUser(userId: string): Promise<UserProfile> {\n  const profile = await fet",
    suffix: "\n}",
    ...overrides,
  });

  const budget: ContextBudget = { maxTokens: 2048 };

  it("should expose provider identity and medium priority", () => {
    const provider = new RecentFilesProvider(new RecentFilesBuffer());
    expect(provider.id).toBe("recent-files");
    expect(provider.name).toBe("Recent Files Provider");
    expect(provider.priority).toBe(ContextPriority.MEDIUM);
  });

  it("should return recent-file chunks for matching targets", async () => {
    const buffer = new RecentFilesBuffer();
    buffer.record({ uri: "file:///src/user-service.ts", language: "typescript", text: relatedFile });

    const provider = new RecentFilesProvider(buffer);
    const chunks = await provider.getContext(makeTarget(), budget);

    expect(chunks.length).toBeGreaterThan(0);
    const chunk = chunks[0];
    expect(chunk.type).toBe("recent");
    expect(chunk.uri).toBe("file:///src/user-service.ts");
    expect(chunk.language).toBe("typescript");
    expect(chunk.symbolName).toBeTruthy();
    expect(chunk.content).toContain("UserProfile");
    expect(chunk.estimatedTokens).toBeGreaterThan(0);
    expect(chunk.metadata?.recencyPosition).toBe(0);
    expect(typeof chunk.metadata?.lastActiveAt).toBe("number");
  });

  it("should assign higher scores to more recently active files", async () => {
    const buffer = new RecentFilesBuffer();
    buffer.record({ uri: "file:///old.ts", language: "typescript", text: relatedFile });
    buffer.record({ uri: "file:///new.ts", language: "typescript", text: relatedFile });

    const provider = new RecentFilesProvider(buffer);
    const chunks = await provider.getContext(makeTarget(), budget);

    const newChunk = chunks.find((c) => c.uri === "file:///new.ts");
    const oldChunk = chunks.find((c) => c.uri === "file:///old.ts");

    expect(newChunk?.score ?? -1).toBeGreaterThan(oldChunk?.score ?? -1);
  });

  it("should rank lexically relevant files above unrelated ones", async () => {
    const buffer = new RecentFilesBuffer();
    buffer.record({ uri: "file:///payments.py", language: "typescript", text: unrelatedFile });
    buffer.record({ uri: "file:///user-profile.ts", language: "typescript", text: relatedFile });

    const provider = new RecentFilesProvider(buffer, { matchLanguage: false });
    const chunks = await provider.getContext(makeTarget(), budget);

    const relatedChunk = chunks.find((c) => c.uri === "file:///user-profile.ts");
    const unrelatedChunk = chunks.find((c) => c.uri === "file:///payments.py");

    expect(relatedChunk?.score ?? -1).toBeGreaterThan(unrelatedChunk?.score ?? -1);
    const relatedLexical = Number(relatedChunk?.metadata?.lexicalScore ?? -1);
    const unrelatedLexical = Number(unrelatedChunk?.metadata?.lexicalScore ?? -1);
    expect(relatedLexical).toBeGreaterThan(unrelatedLexical);
  });

  it("should filter recent files by language when matchLanguage is enabled", async () => {
    const buffer = new RecentFilesBuffer();
    buffer.record({ uri: "file:///payments.py", language: "python", text: unrelatedFile });
    buffer.record({ uri: "file:///helper.tsx", language: "typescriptreact", text: relatedFile });

    const provider = new RecentFilesProvider(buffer);
    const target = makeTarget();

    expect(provider.isAvailable(target)).toBe(true);
    const chunks = await provider.getContext(target, budget);
    expect(chunks.length).toBeGreaterThan(0);
    expect(new Set(chunks.map((c) => c.uri))).toEqual(new Set(["file:///helper.tsx"]));
  });

  it("should exclude the active document from results", async () => {
    const buffer = new RecentFilesBuffer();
    buffer.record({
      uri: "file:///src/active.ts",
      language: "typescript",
      text: relatedFile,
    });

    const provider = new RecentFilesProvider(buffer);
    const chunks = await provider.getContext(makeTarget(), budget);
    expect(chunks).toEqual([]);
  });

  it("should respect minRelevanceScore filtering", async () => {
    const buffer = new RecentFilesBuffer();
    buffer.record({ uri: "file:///unrelated.ts", language: "typescript", text: unrelatedFile });

    const strictProvider = new RecentFilesProvider(buffer, { minRelevanceScore: 60 });
    const chunks = await strictProvider.getContext(makeTarget(), budget);
    expect(chunks).toEqual([]);

    const lenientProvider = new RecentFilesProvider(buffer);
    const lenientChunks = await lenientProvider.getContext(makeTarget(), budget);
    expect(lenientChunks.length).toBeGreaterThan(0);
  });

  it("should limit files and symbols per request", async () => {
    const buffer = new RecentFilesBuffer();
    for (let i = 0; i < 8; i++) {
      buffer.record({
        uri: `file:///gen-${i}.ts`,
        language: "typescript",
        text: relatedFile,
      });
    }

    const provider = new RecentFilesProvider(buffer, { maxFiles: 2, maxSymbolsPerFile: 2 });
    const chunks = await provider.getContext(makeTarget(), budget);

    const uniqueUris = new Set(chunks.map((c) => c.uri));
    expect(uniqueUris.size).toBeLessThanOrEqual(2);
    const perUri = chunks.filter((c) => c.uri === [...uniqueUris][0]);
    expect(perUri.length).toBeLessThanOrEqual(2);
  });

  it("should truncate chunk content to budget constraints", async () => {
    const buffer = new RecentFilesBuffer();
    buffer.record({ uri: "file:///big.ts", language: "typescript", text: relatedFile });

    const provider = new RecentFilesProvider(buffer);
    const chunks = await provider.getContext(
      makeTarget(),
      { maxTokens: 2048, maxLinesPerChunk: 2 }
    );

    expect(chunks.length).toBeGreaterThan(0);
    for (const chunk of chunks) {
      expect(chunk.content.split("\n").length).toBeLessThanOrEqual(2);
    }
  });

  it("should return empty results for an empty buffer or empty file snapshots", async () => {
    const emptyBuffer = new RecentFilesBuffer();
    const provider = new RecentFilesProvider(emptyBuffer);
    expect(await provider.getContext(makeTarget(), budget)).toEqual([]);
    expect(provider.isAvailable(makeTarget())).toBe(false);

    emptyBuffer.record({ uri: "file:///blank.ts", language: "typescript", text: "" });
    expect(provider.isAvailable(makeTarget())).toBe(false);
    expect(await provider.getContext(makeTarget(), budget)).toEqual([]);
  });

  it("should return immediately when the abort signal is already aborted", async () => {
    const buffer = new RecentFilesBuffer();
    buffer.record({ uri: "file:///a.ts", language: "typescript", text: relatedFile });

    const provider = new RecentFilesProvider(buffer);
    const controller = new AbortController();
    controller.abort();

    const chunks = await provider.getContext(makeTarget(), budget, controller.signal);
    expect(chunks).toEqual([]);
  });

  it("should retrieve context asynchronously within <20ms for typical buffers", async () => {
    const buffer = new RecentFilesBuffer();
    for (let i = 0; i < DEFAULT_RECENT_FILES_OPTIONS.maxEntries; i++) {
      buffer.record({
        uri: `file:///perf-${i}.ts`,
        language: "typescript",
        text: `${relatedFile}\n\nexport function extra${i}() { return ${i}; }`,
      });
    }

    const provider = new RecentFilesProvider(buffer);
    const start = performance.now();
    const chunks = await provider.getContext(makeTarget(), budget);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(20);
    expect(chunks.length).toBeGreaterThan(0);
  });
});
