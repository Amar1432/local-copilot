import { describe, expect, it } from "vitest";
import {
  DEFAULT_IMPORT_RESOLVER_OPTIONS,
  IMPORT_SCORE,
  ImportDefinitionResolver,
  computeImportScore,
  extractImportSpecifiers,
  isResolvableSpecifier,
  parseImportLine,
  resolveImportCandidates,
  type ImportFileAccess,
} from "./import-definition-resolver";
import { ContextPriority, type ContextBudget, type ContextTarget } from "./context.types";

describe("parseImportLine", () => {
  it("should parse named imports with aliases and type-only specifiers", () => {
    const parsed = parseImportLine('import { useState, type Context as Ctx } from "react";');
    expect(parsed).not.toBeNull();
    expect(parsed?.kind).toBe("named");
    // "type" keyword stripped; alias "Ctx" is the local binding
    expect(parsed?.names).toEqual(["useState", "Ctx"]);
    expect(parsed?.specifier).toBe("react");
  });

  it("should parse default and namespace imports", () => {
    const def = parseImportLine('import axios from "axios";');
    expect(def?.kind).toBe("default");
    expect(def?.names).toEqual(["axios"]);

    const ns = parseImportLine('import * as Utils from "./utils";');
    expect(ns?.kind).toBe("namespace");
    expect(ns?.names).toEqual(["Utils"]);

    const mixed = parseImportLine('import React, { useState } from "react";');
    expect(mixed?.kind).toBe("named");
    expect(mixed?.names).toContain("React");
    expect(mixed?.names).toContain("useState");
  });

  it("should parse side-effect, require, and export-from forms", () => {
    const sideEffect = parseImportLine('import "./polyfills";');
    expect(sideEffect?.kind).toBe("sideEffect");
    expect(sideEffect?.names).toEqual([]);

    const req = parseImportLine('const { readFile } = require("node:fs");');
    expect(req?.kind).toBe("named");
    expect(req?.names).toEqual(["readFile"]);

    const reqDefault = parseImportLine('const express = require("express");');
    expect(reqDefault?.kind).toBe("default");

    const exportFrom = parseImportLine('export { helper } from "./helpers";');
    expect(exportFrom?.kind).toBe("named");
    expect(exportFrom?.specifier).toBe("./helpers");
  });

  it("should return null for non-import lines", () => {
    expect(parseImportLine("const x = compute();")).toBeNull();
    expect(parseImportLine("// import fake from './fake';")).toBeNull();
    expect(parseImportLine("return importResult;")).toBeNull();
  });
});

describe("extractImportSpecifiers", () => {
  it("should extract all imports in document order", () => {
    const lines = [
      'import axios from "axios";',
      'import { UserProfile } from "./types";',
      "",
      "export function main() {",
      '  return load("./lazy");',
      '}',
    ];
    const parsed = extractImportSpecifiers(lines);
    expect(parsed.map((p) => p.specifier)).toEqual(["axios", "./types"]);
  });
});

describe("isResolvableSpecifier / resolveImportCandidates", () => {
  it("should only classify relative specifiers as resolvable", () => {
    expect(isResolvableSpecifier("./mod")).toBe(true);
    expect(isResolvableSpecifier("../lib/mod")).toBe(true);
    expect(isResolvableSpecifier("react")).toBe(false);
    expect(isResolvableSpecifier("@scope/pkg")).toBe(false);
    expect(isResolvableSpecifier("node:fs")).toBe(false);
  });

  it("should probe extension and index candidates for extension-less specifiers", () => {
    const candidates = resolveImportCandidates(
      "./user-service",
      "file:///src/services/active.ts"
    );
    expect(candidates).toEqual([
      "file:///src/services/user-service.ts",
      "file:///src/services/user-service.tsx",
      "file:///src/services/user-service.js",
      "file:///src/services/user-service.jsx",
      "file:///src/services/user-service.mjs",
      "file:///src/services/user-service.cjs",
      "file:///src/services/user-service/index.ts",
      "file:///src/services/user-service/index.tsx",
      "file:///src/services/user-service/index.js",
      "file:///src/services/user-service/index.jsx",
    ]);
  });

  it("should resolve parent-relative paths with normalization", () => {
    const candidates = resolveImportCandidates("../types", "file:///src/services/a.ts");
    expect(candidates[0]).toBe("file:///src/types.ts");
  });

  it("should keep explicit extensions without probing alternates", () => {
    const candidates = resolveImportCandidates("./data.json", "file:///src/a.ts");
    expect(candidates).toEqual(["file:///src/data.json"]);

    const tsx = resolveImportCandidates("./Widget.tsx", "file:///src/a.ts");
    expect(tsx).toEqual(["file:///src/Widget.tsx"]);
  });

  it("should skip bare package specifiers entirely", () => {
    expect(resolveImportCandidates("lodash/get", "file:///src/a.ts")).toEqual([]);
  });
});

describe("computeImportScore", () => {
  const tokens = new Set(["fetchUser", "UserProfile"]);

  it("should rank referenced bindings above unreferenced ones", () => {
    const referencedNamed = computeImportScore(
      { specifier: "./api", kind: "named", names: ["fetchUser"] },
      tokens
    );
    const plainNamed = computeImportScore(
      { specifier: "./other", kind: "named", names: ["unrelatedThing"] },
      tokens
    );
    expect(referencedNamed).toBeGreaterThan(plainNamed);
    expect(referencedNamed).toBe(IMPORT_SCORE.REFERENCED_NAMED);
  });

  it("should order relationship strength across kinds", () => {
    const referencedNamed = computeImportScore(
      { specifier: "./a", kind: "named", names: ["fetchUser"] },
      tokens
    );
    const plainNamed = computeImportScore(
      { specifier: "./b", kind: "named", names: ["zzz"] },
      tokens
    );
    const referencedDefault = computeImportScore(
      { specifier: "./c", kind: "default", names: ["fetchUser"] },
      tokens
    );
    const plainDefault = computeImportScore(
      { specifier: "./d2", kind: "default", names: ["yyy"] },
      tokens
    );
    const namespace = computeImportScore(
      { specifier: "./d", kind: "namespace", names: ["NS"] },
      tokens
    );
    const sideEffect = computeImportScore(
      { specifier: "./e", kind: "sideEffect", names: [] },
      tokens
    );

    expect(referencedNamed).toBeGreaterThanOrEqual(referencedDefault);
    expect(referencedDefault).toBeGreaterThan(plainNamed);
    expect(plainNamed).toBeGreaterThan(plainDefault);
    expect(plainDefault).toBeGreaterThan(namespace);
    expect(namespace).toBeGreaterThan(sideEffect);
    expect(sideEffect).toBe(ContextPriority.LOW);
  });
});

describe("ImportDefinitionResolver", () => {
  const activeFileText = [
    'import axios from "axios";',
    'import { fetchUserProfile, UserService } from "../services/user-service";',
    'import * as helpers from "../utils/helpers";',
    'import "./side-effects";',
    "",
    "export async function loadUser(userId: string) {",
    "  const profile = await fetchUserProfile(userId);",
    "  return new UserService().enrich(profile);",
    "}",
  ].join("\n");

  const userServiceText = [
    "export interface UserService {",
    "  enrich(profile: unknown): unknown;",
    "}",
    "",
    "export function fetchUserProfile(userId: string): Promise<unknown> {",
    "  return Promise.resolve({ userId });",
    "}",
    "",
    "export function unrelatedHelper() {",
    "  return null;",
    "}",
  ].join("\n");

  const makeFileAccess = (
    files: Record<string, string>
  ): ImportFileAccess & { existingCalls: number } => {
    const access = {
      existingCalls: 0,
      async findExisting(uris: readonly string[]) {
        access.existingCalls++;
        return uris.filter((uri) => files[uri] !== undefined);
      },
      async readText(uri: string) {
        return files[uri] ?? null;
      },
    };
    return access;
  };

  const makeTarget = (overrides: Partial<ContextTarget> = {}): ContextTarget => ({
    documentUri: "file:///src/handlers/users.handler.ts",
    documentVersion: 1,
    language: "typescript",
    position: { line: 7, character: 20 },
    prefix: activeFileText.slice(0, 200),
    suffix: activeFileText.slice(200),
    fullText: activeFileText,
    ...overrides,
  });

  const budget: ContextBudget = { maxTokens: 2048 };

  const expectedUserServiceUri = "file:///src/services/user-service.ts";

  it("should expose provider identity and high priority", () => {
    const resolver = new ImportDefinitionResolver(makeFileAccess({}));
    expect(resolver.id).toBe("import-resolver");
    expect(resolver.name).toBe("Import/Definition Resolver");
    expect(resolver.priority).toBe(ContextPriority.HIGH);
  });

  it("should be available only for TypeScript/JavaScript targets", () => {
    const resolver = new ImportDefinitionResolver(makeFileAccess({}));
    expect(resolver.isAvailable(makeTarget())).toBe(true);
    expect(resolver.isAvailable(makeTarget({ language: "typescriptreact" }))).toBe(true);
    expect(resolver.isAvailable(makeTarget({ language: "python" }))).toBe(false);
  });

  it("should resolve relative imports to workspace file URIs and emit definition chunks", async () => {
    const fileAccess = makeFileAccess({
      [expectedUserServiceUri]: userServiceText,
    });
    const resolver = new ImportDefinitionResolver(fileAccess);

    const chunks = await resolver.getContext(makeTarget(), budget);

    expect(chunks.length).toBeGreaterThan(0);
    const chunk = chunks[0];
    expect(chunk.uri).toBe(expectedUserServiceUri);
    expect(chunk.type).toBe("definition");
    expect(chunk.symbolName).toBeTruthy();
    expect(chunk.content).not.toContain("unrelatedHelper");
    expect(chunk.metadata?.specifier).toBe("../services/user-service");
    expect(typeof chunk.metadata?.relationshipScore).toBe("number");
    expect(chunk.estimatedTokens).toBeGreaterThan(0);
  });

  it("should prefer symbols matching imported names over unrelated ones", async () => {
    const fileAccess = makeFileAccess({
      [expectedUserServiceUri]: userServiceText,
    });
    // Cap at 2 so only the imported-name matches survive extraction
    const resolver = new ImportDefinitionResolver(fileAccess, { maxSymbolsPerFile: 2 });

    const chunks = await resolver.getContext(makeTarget(), budget);
    const symbolNames = chunks.map((c) => c.symbolName);

    // Imported symbols first (document order), unrelated symbol dropped by the cap
    expect(symbolNames).toEqual(["UserService", "fetchUserProfile"]);
  });

  it("should score imported symbols referenced near the cursor higher than unreferenced imports", async () => {
    const files: Record<string, string> = {
      [expectedUserServiceUri]: userServiceText,
      "file:///src/utils/helpers.ts": "export function formatName(n: string) { return n; }",
    };
    const resolver = new ImportDefinitionResolver(makeFileAccess(files));
    const chunks = await resolver.getContext(makeTarget(), budget);

    const userChunk = chunks.find((c) => c.uri === expectedUserServiceUri);
    const helpersChunk = chunks.find((c) => c.uri === "file:///src/utils/helpers.ts");

    expect(userChunk?.score ?? -1).toBeGreaterThan(helpersChunk?.score ?? -1);
  });

  it("should deduplicate multiple imports of the same resolved file", async () => {
    const text = [
      'import { fetchUserProfile } from "../services/user-service";',
      'import { UserService } from "../services/user-service";',
      "",
      "const x = fetchUserProfile;",
    ].join("\n");

    let readCount = 0;
    const fileAccess: ImportFileAccess = {
      async findExisting(uris) {
        return uris.filter((uri) => uri === expectedUserServiceUri);
      },
      async readText() {
        readCount++;
        return userServiceText;
      },
    };
    const resolver = new ImportDefinitionResolver(fileAccess);
    const chunks = await resolver.getContext(
      makeTarget({
        fullText: text,
        prefix: text,
        suffix: "",
      }),
      budget
    );

    const uniqueUris = new Set(chunks.map((c) => c.uri));
    expect(uniqueUris.size).toBe(1);
    expect(readCount).toBe(1);
  });

  it("should respect minImportScore filtering for side-effect imports", async () => {
    const files: Record<string, string> = {
      "file:///src/side-effects.ts": "export function boot() {}",
      "file:///src/utils/helpers.ts": "export function formatName(n: string) { return n; }",
    };
    // Threshold at NAMESPACE keeps namespace imports but drops side-effect imports
    const resolver = new ImportDefinitionResolver(makeFileAccess(files), {
      minImportScore: IMPORT_SCORE.NAMESPACE,
    });
    const chunks = await resolver.getContext(makeTarget(), budget);

    const specifiers = new Set(chunks.map((c) => c.metadata?.specifier));
    expect(specifiers.has("./side-effects")).toBe(false);
    expect(chunks.length).toBeGreaterThan(0);
  });

  it("should cap imports and symbols per request", async () => {
    const lines: string[] = [];
    const files: Record<string, string> = {};
    for (let i = 0; i < 12; i++) {
      lines.push(`import { sym${i}A } from "./gen/mod${i}";`);
      files[`file:///src/gen/mod${i}.ts`] = [
        `export function sym${i}A() {}`,
        `export function sym${i}B() {}`,
        `export function sym${i}C() {}`,
        `export function sym${i}D() {}`,
      ].join("\n");
    }
    const text = lines.join("\n");

    const resolver = new ImportDefinitionResolver(makeFileAccess(files), {
      maxImports: 4,
      maxSymbolsPerFile: 2,
    });
    const chunks = await resolver.getContext(
      makeTarget({ documentUri: "file:///src/main.ts", fullText: text, prefix: text, suffix: "" }),
      budget
    );

    const uniqueUris = new Set(chunks.map((c) => c.uri));
    expect(uniqueUris.size).toBe(4);
    expect(chunks.length).toBe(8);
  });

  it("should truncate chunk content to budget constraints", async () => {
    const longBody = Array.from({ length: 30 }, (_, i) => `  step${i};`).join("\n");
    const files: Record<string, string> = {
      [expectedUserServiceUri]: `export function big() {\n${longBody}\n}`,
    };
    const resolver = new ImportDefinitionResolver(makeFileAccess(files));

    const chunks = await resolver.getContext(
      makeTarget(),
      { maxTokens: 2048, maxLinesPerChunk: 3 }
    );
    expect(chunks.length).toBeGreaterThan(0);
    for (const chunk of chunks) {
      expect(chunk.content.split("\n").length).toBeLessThanOrEqual(3);
    }
  });

  it("should return empty results when nothing resolves or language is unsupported", async () => {
    const resolver = new ImportDefinitionResolver(makeFileAccess({}));
    expect(await resolver.getContext(makeTarget(), budget)).toEqual([]);

    const pythonResolver = new ImportDefinitionResolver(makeFileAccess({}));
    expect(
      await pythonResolver.getContext(makeTarget({ language: "python" }), budget)
    ).toEqual([]);
  });

  it("should stop early when the abort signal fires mid-resolution", async () => {
    const controller = new AbortController();

    const fileAccess: ImportFileAccess = {
      async findExisting(uris) {
        controller.abort();
        return uris.filter((uri) => uri === expectedUserServiceUri);
      },
      async readText(uri) {
        return uri === expectedUserServiceUri ? userServiceText : null;
      },
    };

    const resolver = new ImportDefinitionResolver(fileAccess);
    const chunks = await resolver.getContext(makeTarget(), budget, controller.signal);
    expect(chunks).toEqual([]);
  });

  it("should retrieve context asynchronously within <20ms for in-memory files", async () => {
    const files: Record<string, string> = {};
    const lines: string[] = [];
    for (let i = 0; i < DEFAULT_IMPORT_RESOLVER_OPTIONS.maxImports; i++) {
      lines.push(`import { sym${i} } from "./gen/mod${i}";`);
      files[`file:///src/gen/mod${i}.ts`] = `export function sym${i}() {\n  return ${i};\n}`;
    }
    const text = lines.join("\n");

    const resolver = new ImportDefinitionResolver(makeFileAccess(files));
    const start = performance.now();
    const chunks = await resolver.getContext(
      makeTarget({ documentUri: "file:///src/main.ts", fullText: text, prefix: text, suffix: "" }),
      budget
    );
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(20);
    expect(chunks.length).toBeGreaterThan(0);
  });
});
