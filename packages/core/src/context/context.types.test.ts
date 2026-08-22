import { describe, expect, it } from "vitest";
import {
  ContextPriority,
  type ContextBudget,
  type ContextChunk,
  type ContextProvider,
  type ContextTarget,
} from "./context.types";

describe("Context Types", () => {
  it("should define ContextPriority enum with proper weight hierarchy", () => {
    expect(ContextPriority.CRITICAL).toBe(100);
    expect(ContextPriority.HIGH).toBe(75);
    expect(ContextPriority.MEDIUM).toBe(50);
    expect(ContextPriority.LOW).toBe(25);
    expect(ContextPriority.BACKGROUND).toBe(10);
    expect(ContextPriority.CRITICAL).toBeGreaterThan(ContextPriority.HIGH);
    expect(ContextPriority.HIGH).toBeGreaterThan(ContextPriority.MEDIUM);
    expect(ContextPriority.MEDIUM).toBeGreaterThan(ContextPriority.LOW);
    expect(ContextPriority.LOW).toBeGreaterThan(ContextPriority.BACKGROUND);
  });

  it("should instantiate a valid ContextTarget", () => {
    const target: ContextTarget = {
      documentUri: "file:///src/app.ts",
      documentVersion: 1,
      language: "typescript",
      position: { line: 10, character: 5 },
      prefix: "const x = ",
      suffix: ";\nexport default x;",
      fullText: "import { a } from \"./a\";\n\nconst x = ;\nexport default x;",
      workspaceRoot: "/workspace",
    };

    expect(target.documentUri).toBe("file:///src/app.ts");
    expect(target.language).toBe("typescript");
    expect(target.position.line).toBe(10);
  });

  it("should support creating all 4 context chunk types", () => {
    const fileChunk: ContextChunk = {
      id: "chunk-file-1",
      type: "file",
      uri: "file:///src/utils.ts",
      content: "export function helper() {}",
      score: ContextPriority.HIGH,
      range: { startLine: 1, endLine: 5 },
      language: "typescript",
    };

    const recentChunk: ContextChunk = {
      id: "chunk-recent-1",
      type: "recent",
      uri: "file:///src/models.ts",
      content: "export interface User { id: string }",
      score: ContextPriority.MEDIUM,
      language: "typescript",
    };

    const importChunk: ContextChunk = {
      id: "chunk-import-1",
      type: "import",
      uri: "file:///src/services/api.ts",
      content: "export const fetchUsers = () => {}",
      score: ContextPriority.HIGH,
      symbolName: "fetchUsers",
      language: "typescript",
    };

    const defChunk: ContextChunk = {
      id: "chunk-def-1",
      type: "definition",
      uri: "file:///src/types.ts",
      content: "export type UserId = string;",
      score: ContextPriority.CRITICAL,
      symbolName: "UserId",
      range: { startLine: 10, endLine: 10 },
      metadata: { isExported: true },
    };

    expect(fileChunk.type).toBe("file");
    expect(recentChunk.type).toBe("recent");
    expect(importChunk.type).toBe("import");
    expect(defChunk.type).toBe("definition");
  });

  it("should support custom ContextProvider implementation", async () => {
    class MockContextProvider implements ContextProvider {
      readonly id = "mock-provider";
      readonly name = "Mock Context Provider";
      readonly priority = ContextPriority.MEDIUM;

      async isAvailable(_target: ContextTarget): Promise<boolean> {
        return true;
      }

      async getContext(
        target: ContextTarget,
        _budget: ContextBudget,
        _signal?: AbortSignal
      ): Promise<readonly ContextChunk[]> {
        return [
          {
            id: "mock-1",
            type: "file",
            uri: target.documentUri,
            content: "// Mock context",
            score: this.priority,
          },
        ];
      }
    }

    const provider = new MockContextProvider();
    expect(provider.id).toBe("mock-provider");
    expect(provider.priority).toBe(50);

    const target: ContextTarget = {
      documentUri: "file:///test.ts",
      documentVersion: 1,
      language: "typescript",
      position: { line: 0, character: 0 },
      prefix: "",
      suffix: "",
    };

    const budget: ContextBudget = { maxTokens: 500 };
    const chunks = await provider.getContext(target, budget);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe("// Mock context");
  });
});
