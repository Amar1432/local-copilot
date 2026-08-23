/**
 * FileContextExtractor — extracts semantic context chunks from the active file,
 * such as imports, current enclosing function/class scopes, and nearby declarations.
 */

import {
  ContextPriority,
  type ContextBudget,
  type ContextChunk,
  type ContextProvider,
  type ContextTarget,
  type DocumentRange,
} from "./context.types";
import { estimateTokenCount } from "./context-budget";

/**
 * Regex patterns for identifying imports across supported languages
 */
const IMPORT_PATTERNS: Record<string, RegExp[]> = {
  typescript: [
    /^\s*import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|[\w$]+)(?:\s*,\s*(?:\{[^}]*\}|\*\s+as\s+\w+|[\w$]+))?\s+from)?\s*["\x27][^"\x27]+["\x27]/,
    /^\s*import\s*["\x27][^"\x27]+["\x27]/,
    /^\s*(?:const|let|var)\s+(?:\{[^}]*\}|[\w$]+)\s*=\s*require\s*\(/,
  ],
  javascript: [
    /^\s*import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|[\w$]+)(?:\s*,\s*(?:\{[^}]*\}|\*\s+as\s+\w+|[\w$]+))?\s+from)?\s*["\x27][^"\x27]+["\x27]/,
    /^\s*import\s*["\x27][^"\x27]+["\x27]/,
    /^\s*(?:const|let|var)\s+(?:\{[^}]*\}|[\w$]+)\s*=\s*require\s*\(/,
  ],
  python: [
    /^\s*import\s+[\w, ]+/,
    /^\s*from\s+[\w.]+\s+import\s+[\w*, ()]+/,
  ],
  go: [
    /^\s*import\s+(?:\([\s\S]*?\)|["\x27][^"\x27]+["\x27])/,
    /^\s*package\s+\w+/,
  ],
  rust: [
    /^\s*use\s+[\w:]+(?:\s*as\s+\w+|\s*\{[^}]*\})?;/,
    /^\s*extern\s+crate\s+\w+;/,
    /^\s*mod\s+\w+;/,
  ],
  java: [
    /^\s*import\s+(?:static\s+)?[\w.*]+;/,
    /^\s*package\s+[\w.]+;/,
  ],
  cpp: [
    /^\s*#\s*include\s+[<"][^>"]+[>"]/,
  ],
  c: [
    /^\s*#\s*include\s+[<"][^>"]+[>"]/,
  ],
};

/**
 * Regex patterns for scope headers (functions, classes, interfaces, types, structs)
 */
const SCOPE_PATTERNS = [
  /^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*([\w$]+)?\s*\(/,
  /^(?:export\s+)?(?:const|let|var)\s+([\w$]+)\s*(?::[^=]+)?=\s*(?:async\s*)?(?:\([^)]*\)|[\w$]+)\s*=>/,
  /^(?:export\s+)?(?:abstract\s+)?class\s+([\w$]+)/,
  /^(?:export\s+)?interface\s+([\w$]+)/,
  /^(?:export\s+)?type\s+([\w$]+)\s*=/,
  /^(?:export\s+)?enum\s+([\w$]+)/,
  /^(?:async\s+)?def\s+([\w_]+)\s*\(/,
  /^class\s+([\w_]+)(?:\([^)]*\))?:/,
  /^func\s+(?:\([^)]*\)\s+)?([\w]+)\s*\(/,
  /^type\s+([\w]+)\s+(?:struct|interface)\b/,
  /^(?:pub\s+)?(?:async\s+)?fn\s+([\w_]+)\s*(?:<[^>]*>)?\s*\(/,
  /^(?:pub\s+)?struct\s+([\w_]+)/,
  /^(?:pub\s+)?enum\s+([\w_]+)/,
  /^(?:pub\s+)?trait\s+([\w_]+)/,
  /^(?:pub\s+)?impl(?:<[^>]*>)?\s+(?:[\w_]+(?:\s+for\s+)?)+([\w_]+)/,
  /^(?:public|protected|private)?\s*(?:static\s+)?(?:final\s+)?(?:abstract\s+)?(?:class|interface|enum|record)\s+([\w$]+)/,
];

/**
 * Normalize language identifier for pattern matching
 */
function normalizeLanguage(lang: string): string {
  const lower = lang.toLowerCase();
  if (lower === "typescriptreact" || lower === "tsx") return "typescript";
  if (lower === "javascriptreact" || lower === "jsx") return "javascript";
  if (lower === "c++") return "cpp";
  if (lower === "py") return "python";
  if (lower === "golang") return "go";
  if (lower === "rs") return "rust";
  return lower;
}

/**
 * Extract import statements from document text
 */
export function extractImportsFromLines(
  lines: readonly string[],
  language: string
): { content: string; range: DocumentRange; count: number } | null {
  const normLang = normalizeLanguage(language);
  const patterns = IMPORT_PATTERNS[normLang] || IMPORT_PATTERNS.typescript;

  const importLines: string[] = [];
  let firstLine = -1;
  let lastLine = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Scan up to line 100 or until non-import code is heavily established
    if (i > 100 && importLines.length === 0) {
      break;
    }

    const matches = patterns.some((p) => p.test(line));
    if (matches) {
      if (firstLine === -1) firstLine = i + 1;
      lastLine = i + 1;
      importLines.push(line);
    }
  }

  if (importLines.length === 0) {
    return null;
  }

  const content = importLines.join("\n");
  return {
    content,
    range: { startLine: firstLine, endLine: lastLine },
    count: importLines.length,
  };
}

/**
 * Find enclosing function, class, or type definition above cursor
 */
export function extractEnclosingScope(
  lines: readonly string[],
  cursorLine: number
): { content: string; range: DocumentRange; symbolName?: string } | null {
  const scanLimit = Math.max(0, cursorLine - 100);

  for (let i = cursorLine; i >= scanLimit; i--) {
    const line = lines[i] || "";
    for (const pattern of SCOPE_PATTERNS) {
      const match = line.match(pattern);
      if (match) {
        const symbolName = match[1] || undefined;
        // Take a small window around the definition header (up to 5 lines)
        const headerLines: string[] = [];
        for (let j = i; j <= Math.min(lines.length - 1, i + 4); j++) {
          headerLines.push(lines[j]);
          if (lines[j].includes("{") || lines[j].includes(":") || lines[j].trim().endsWith("=>")) {
            break;
          }
        }

        const content = headerLines.join("\n");
        return {
          content,
          range: { startLine: i + 1, endLine: i + headerLines.length },
          symbolName,
        };
      }
    }
  }

  return null;
}

/**
 * Extract top-level or nearby type declarations (interfaces, types, classes, structs)
 */
export function extractNearbyDeclarations(
  lines: readonly string[],
  cursorLine: number,
  maxCount = 3
): Array<{ content: string; range: DocumentRange; symbolName: string }> {
  const declarations: Array<{ content: string; range: DocumentRange; symbolName: string }> = [];
  const declPattern = /^(?:export\s+|pub\s+|public\s+|protected\s+|private\s+)?(?:interface|type|class|struct|enum|trait|record)\s+([\w$]+)/;

  for (let i = 0; i < lines.length; i++) {
    // Skip line if it is inside the active cursor immediate window (+/- 5 lines)
    if (Math.abs(i - cursorLine) <= 5) continue;

    const line = lines[i] || "";
    const match = line.match(declPattern);
    if (match && match[1]) {
      const symbolName = match[1];
      // Extract up to 10 lines of the declaration
      const chunkLines: string[] = [line];
      let bracketCount = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;

      for (let j = i + 1; j < Math.min(lines.length, i + 15); j++) {
        const nextLine = lines[j];
        chunkLines.push(nextLine);
        bracketCount += (nextLine.match(/\{/g) || []).length - (nextLine.match(/\}/g) || []).length;
        if (bracketCount <= 0 && (nextLine.includes("}") || nextLine.includes(";"))) {
          break;
        }
      }

      declarations.push({
        content: chunkLines.join("\n"),
        range: { startLine: i + 1, endLine: i + chunkLines.length },
        symbolName,
      });

      if (declarations.length >= maxCount) {
        break;
      }
    }
  }

  return declarations;
}

/**
 * File Context Extractor implementing ContextProvider
 */
export class FileContextExtractor implements ContextProvider {
  readonly id = "file";
  readonly name = "File Context Extractor";
  readonly priority = ContextPriority.HIGH;

  /**
   * Extract semantic context chunks from the active target file
   */
  async getContext(
    target: ContextTarget,
    _budget: ContextBudget,
    _signal?: AbortSignal
  ): Promise<readonly ContextChunk[]> {
    const startTime = Date.now();
    const chunks: ContextChunk[] = [];

    const fullText = target.fullText ?? [target.prefix, target.suffix].join("");
    if (!fullText.trim()) {
      return chunks;
    }

    const lines = fullText.split("\n");
    const cursorLine = Math.min(target.position.line, lines.length - 1);

    // 1. Extract imports
    const importsResult = extractImportsFromLines(lines, target.language);
    if (importsResult && importsResult.content.trim()) {
      chunks.push({
        id: `${this.id}-imports-${target.documentVersion}`,
        type: "import",
        uri: target.documentUri,
        content: importsResult.content,
        score: ContextPriority.HIGH,
        language: target.language,
        range: importsResult.range,
        estimatedTokens: estimateTokenCount(importsResult.content),
        metadata: {
          importCount: importsResult.count,
        },
      });
    }

    // 2. Extract enclosing scope
    const scopeResult = extractEnclosingScope(lines, cursorLine);
    if (scopeResult && scopeResult.content.trim()) {
      chunks.push({
        id: `${this.id}-scope-${target.documentVersion}`,
        type: "file",
        uri: target.documentUri,
        content: scopeResult.content,
        score: ContextPriority.CRITICAL,
        language: target.language,
        symbolName: scopeResult.symbolName,
        range: scopeResult.range,
        estimatedTokens: estimateTokenCount(scopeResult.content),
        metadata: {
          scopeType: "enclosing",
        },
      });
    }

    // 3. Extract nearby type / class declarations
    const nearbyDecls = extractNearbyDeclarations(lines, cursorLine, 3);
    for (let i = 0; i < nearbyDecls.length; i++) {
      const decl = nearbyDecls[i];
      // Distance-decay score: closer declarations get higher scores
      const distance = Math.abs(decl.range.startLine - (cursorLine + 1));
      const distanceScore = Math.max(ContextPriority.LOW, ContextPriority.HIGH - Math.floor(distance / 10));

      chunks.push({
        id: `${this.id}-decl-${i}-${target.documentVersion}`,
        type: "definition",
        uri: target.documentUri,
        content: decl.content,
        score: distanceScore,
        language: target.language,
        symbolName: decl.symbolName,
        range: decl.range,
        estimatedTokens: estimateTokenCount(decl.content),
        metadata: {
          distance,
        },
      });
    }

    // Fast check for latency limit (<20ms)
    const elapsed = Date.now() - startTime;
    if (elapsed > 20) {
      console.warn(`[FileContextExtractor] Extraction took ${elapsed}ms (target <20ms)`);
    }

    return chunks;
  }
}
