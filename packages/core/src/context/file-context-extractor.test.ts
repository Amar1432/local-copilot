import { describe, expect, it } from "vitest";
import {
  extractEnclosingScope,
  extractImportsFromLines,
  extractNearbyDeclarations,
  FileContextExtractor,
} from "./file-context-extractor";
import { ContextPriority, type ContextBudget, type ContextTarget } from "./context.types";

describe("FileContextExtractor", () => {
  const sampleTsFile = [
    "import { useState, useEffect } from \"react\";",
    "import axios from \"axios\";",
    "",
    "export interface UserProfile {",
    "  id: string;",
    "  name: string;",
    "  email: string;",
    "}",
    "",
    "export type UserStatus = \"active\" | \"inactive\";",
    "",
    "export function fetchUserProfile(userId: string): Promise<UserProfile> {",
    "  const endpoint = '/api/users/' + userId;",
    "  return axios.get(endpoint);",
    "}",
    "",
    "export class UserService {",
    "  async getUser(id: string) {",
    "    const user = await fetchUserProfile(id);",
    "    return user;",
    "  }",
    "}",
  ].join("\n");

  it("should extract typescript imports from lines", () => {
    const lines = sampleTsFile.split("\n");
    const result = extractImportsFromLines(lines, "typescript");
    expect(result).not.toBeNull();
    expect(result?.count).toBe(2);
    expect(result?.content).toContain("import { useState, useEffect } from \"react\";");
    expect(result?.content).toContain("import axios from \"axios\";");
    expect(result?.range.startLine).toBe(1);
    expect(result?.range.endLine).toBe(2);
  });

  it("should extract python imports", () => {
    const pythonCode = [
      "import os",
      "import sys",
      "from typing import List, Optional",
      "",
      "def main():",
      "    pass",
    ];
    const result = extractImportsFromLines(pythonCode, "python");
    expect(result).not.toBeNull();
    expect(result?.count).toBe(3);
    expect(result?.content).toContain("from typing import List, Optional");
  });

  it("should extract enclosing function scope", () => {
    const lines = sampleTsFile.split("\n");
    // Line 14 is inside fetchUserProfile
    const result = extractEnclosingScope(lines, 14);
    expect(result).not.toBeNull();
    expect(result?.symbolName).toBe("fetchUserProfile");
    expect(result?.content).toContain("export function fetchUserProfile");
  });

  it("should extract enclosing class scope", () => {
    const lines = sampleTsFile.split("\n");
    // Line 20 is inside UserService
    const result = extractEnclosingScope(lines, 20);
    expect(result).not.toBeNull();
    expect(result?.symbolName).toBe("UserService");
    expect(result?.content).toContain("export class UserService");
  });

  it("should extract nearby declarations", () => {
    const lines = sampleTsFile.split("\n");
    // Cursor at line 20
    const decls = extractNearbyDeclarations(lines, 20, 3);
    expect(decls.length).toBeGreaterThanOrEqual(1);
    const names = decls.map((d) => d.symbolName);
    expect(names).toContain("UserProfile");
  });

  it("should extract context chunks in FileContextExtractor.getContext within <20ms", async () => {
    const extractor = new FileContextExtractor();
    expect(extractor.id).toBe("file");
    expect(extractor.priority).toBe(ContextPriority.HIGH);

    const target: ContextTarget = {
      documentUri: "file:///src/user.service.ts",
      documentVersion: 2,
      language: "typescript",
      position: { line: 14, character: 10 },
      prefix: sampleTsFile.slice(0, 300),
      suffix: sampleTsFile.slice(300),
      fullText: sampleTsFile,
    };

    const budget: ContextBudget = { maxTokens: 1000 };
    const start = performance.now();
    const chunks = await extractor.getContext(target, budget);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(20);
    expect(chunks.length).toBeGreaterThan(0);

    const importChunk = chunks.find((c) => c.type === "import");
    expect(importChunk).toBeDefined();
    expect(importChunk?.uri).toBe("file:///src/user.service.ts");
    expect(importChunk?.score).toBe(ContextPriority.HIGH);

    const scopeChunk = chunks.find((c) => c.type === "file");
    expect(scopeChunk).toBeDefined();
    expect(scopeChunk?.symbolName).toBe("fetchUserProfile");
    expect(scopeChunk?.score).toBe(ContextPriority.CRITICAL);

    const defChunk = chunks.find((c) => c.type === "definition");
    expect(defChunk).toBeDefined();
  });

  it("should return empty list when document text is empty", async () => {
    const extractor = new FileContextExtractor();
    const target: ContextTarget = {
      documentUri: "file:///empty.ts",
      documentVersion: 1,
      language: "typescript",
      position: { line: 0, character: 0 },
      prefix: "",
      suffix: "",
      fullText: "",
    };

    const chunks = await extractor.getContext(target, { maxTokens: 500 });
    expect(chunks).toEqual([]);
  });
});
