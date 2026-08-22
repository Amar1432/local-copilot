/**
 * ImportDefinitionResolver — resolves relative/index-based import specifiers
 * from the active TypeScript/JavaScript file to workspace files and extracts
 * symbol definition chunks from the imported sources.
 */

import {
  ContextPriority,
  type ContextBudget,
  type ContextChunk,
  type ContextProvider,
  type ContextTarget,
} from "./context.types";
import { estimateTokenCount } from "./context-budget";
import {
  extractTopLevelSymbols,
  extractIdentifierTokens,
  normalizeLanguageId,
} from "./recent-files-provider";

/**
 * File access bridge used by the resolver. Implemented by the host
 * environment (VS Code workspace FS); tests provide in-memory implementations.
 */
export interface ImportFileAccess {
  /** Return the subset of candidate URIs that exist, preserving order */
  findExisting(uris: readonly string[]): Promise<readonly string[]>;
  /** Read full text of a file, or null when unreadable */
  readText(uri: string): Promise<string | null>;
}

/**
 * Configuration options for the import/definition resolver
 */
export interface ImportResolverOptions {
  /** Maximum number of relative import statements considered per request */
  maxImports: number;
  /** Maximum symbol chunks extracted per resolved file */
  maxSymbolsPerFile: number;
  /** Minimum relationship score required to emit chunks for an import */
  minImportScore: number;
}

/**
 * Default configuration for import resolution and extraction
 */
export const DEFAULT_IMPORT_RESOLVER_OPTIONS: ImportResolverOptions = {
  maxImports: 8,
  maxSymbolsPerFile: 3,
  minImportScore: ContextPriority.LOW,
};

/**
 * Relationship strength scores for import kinds (0-100)
 */
export const IMPORT_SCORE = {
  REFERENCED_NAMED: 90,
  REFERENCED_DEFAULT: 85,
  NAMED: ContextPriority.HIGH,
  DEFAULT: 70,
  NAMESPACE: 60,
  SIDE_EFFECT: ContextPriority.LOW,
} as const;

/**
 * File extensions probed when resolving extension-less specifiers
 */
const RESOLVE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"] as const;

/**
 * Extensions that indicate a specifier already points at a concrete file
 */
const KNOWN_FILE_EXTENSIONS = [...RESOLVE_EXTENSIONS, ".json"] as const;

/**
 * The kind of an import clause
 */
export type ImportKind = "named" | "default" | "namespace" | "sideEffect";

/**
 * A parsed import statement from the active file
 */
export interface ParsedImport {
  /** Raw module specifier exactly as written */
  readonly specifier: string;
  /** Import clause classification */
  readonly kind: ImportKind;
  /** Locally bound symbol names introduced by this import */
  readonly names: readonly string[];
}

/**
 * Split a document URI into a scheme prefix ("file://" or "") and path part
 */
function splitUri(uri: string): { scheme: string; path: string } {
  const match = uri.match(/^([a-zA-Z][\w+.-]*:\/\/)(.*)$/);
  if (match) {
    return { scheme: match[1], path: match[2] };
  }
  return { scheme: "", path: uri };
}

/**
 * Minimal posix-style dirname for URI paths
 */
function dirname(path: string): string {
  const idx = path.lastIndexOf("/");
  if (idx <= 0) {
    return idx === 0 ? "/" : "";
  }
  return path.slice(0, idx);
}

/**
 * Resolve "." and ".." segments in a posix-style path
 */
function normalizePath(path: string): string {
  const isAbsolute = path.startsWith("/");
  const segments: string[] = [];
  for (const segment of path.split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") {
      if (segments.length > 0 && segments[segments.length - 1] !== "..") {
        segments.pop();
      } else if (!isAbsolute) {
        segments.push("..");
      }
      continue;
    }
    segments.push(segment);
  }
  const joined = segments.join("/");
  return isAbsolute ? `/${joined}` : joined || ".";
}

/**
 * Join a base directory and a relative specifier into a normalized path
 */
function joinRelativePath(baseDir: string, specifier: string): string {
  return normalizePath(`${baseDir}/${specifier}`);
}

/**
 * Check whether a module specifier is resolvable to a workspace file
 * (relative paths only; bare package specifiers are skipped)
 */
export function isResolvableSpecifier(specifier: string): boolean {
  return specifier.startsWith("./") || specifier.startsWith("../");
}

/**
 * Parse a single ES import/export-from or CJS require line into a ParsedImport
 */
export function parseImportLine(line: string): ParsedImport | null {
  const trimmed = line.trim();

  // ES import: import <clause> from "<specifier>" / import "<specifier>"
  const esMatch = trimmed.match(
    /^import\s+(?:type\s+)?(?:([\s\S]+?)\s+from\s+)?["']([^"']+)["']\s*;?\s*$/
  );
  if (esMatch) {
    const clause = esMatch[1];
    const specifier = esMatch[2];

    if (!clause) {
      return { specifier, kind: "sideEffect", names: [] };
    }

    const namedMatch = clause.match(/\{([^}]*)\}/);
    const namespaceMatch = clause.match(/\*\s+as\s+([\w$]+)/);

    if (namedMatch) {
      const braceNames = (namedMatch[1] ?? "")
        .split(",")
        .map((part) => {
          const cleaned = part.replace(/\btype\s+/g, "").trim();
          // Handle "original as alias": the local binding is the alias
          const asMatch = cleaned.match(/^[\w$]+\s+as\s+([\w$]+)$/);
          return asMatch ? asMatch[1] : cleaned;
        })
        .filter((name) => /^[\w$]+$/.test(name));

      // Default binding alongside named imports: import D, { a } from "m"
      const beforeBraces = clause.slice(0, namedMatch.index ?? 0).replace(/,\s*$/, "").trim();
      if (/^[\w$]+$/.test(beforeBraces)) {
        braceNames.unshift(beforeBraces);
      }

      if (braceNames.length > 0) {
        return { specifier, kind: "named", names: braceNames };
      }
      return { specifier, kind: "sideEffect", names: [] };
    }

    if (namespaceMatch) {
      return { specifier, kind: "namespace", names: [namespaceMatch[1]] };
    }

    if (/^[\w$]+$/.test(clause.trim())) {
      return { specifier, kind: "default", names: [clause.trim()] };
    }

    return { specifier, kind: "sideEffect", names: [] };
  }

  // Export re-exports: export { a, b } from "<specifier>" / export * from "<specifier>"
  const exportFromMatch = trimmed.match(/^export\s+(?:\{[^}]*\}|\*(?:\s+as\s+[\w$]+)?)\s+from\s+["']([^"']+)["']\s*;?\s*$/);
  if (exportFromMatch) {
    return { specifier: exportFromMatch[1], kind: "named", names: [] };
  }

  // CJS require with destructuring or direct binding
  const requireMatch = trimmed.match(
    /^(?:const|let|var)\s+(?:(\{[^}]*\})|([\w$]+))\s*=\s*require\(\s*["']([^"']+)["']\s*\)/
  );
  if (requireMatch) {
    const specifier = requireMatch[3];
    if (requireMatch[2]) {
      return { specifier, kind: "default", names: [requireMatch[2]] };
    }
    const destructured = (requireMatch[1] ?? "")
      .slice(1, -1)
      .split(",")
      .map((part) => {
        const asMatch = part.trim().match(/^[\w$]+\s*:\s*([\w$]+)$/);
        return asMatch ? asMatch[1] : part.replace(/\btype\s+/g, "").trim();
      })
      .filter((name) => /^[\w$]+$/.test(name));
    return destructured.length > 0
      ? { specifier, kind: "named", names: destructured }
      : { specifier, kind: "namespace", names: [] };
  }

  return null;
}

/**
 * Extract all resolvable import statements from document lines.
 * Bare package specifiers are included but flagged via isResolvableSpecifier.
 */
export function extractImportSpecifiers(lines: readonly string[]): ParsedImport[] {
  const parsed: ParsedImport[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("//")) continue;
    // Stop scanning deep in the file; imports live near the top
    if (i > 100 && parsed.length === 0) break;

    const result = parseImportLine(line);
    if (result) {
      parsed.push(result);
    }
  }

  return parsed;
}

/**
 * Compute the ordered list of candidate URIs for an import specifier.
 * Probes explicit extensions first, then index files.
 */
export function resolveImportCandidates(specifier: string, sourceUri: string): string[] {
  if (!isResolvableSpecifier(specifier)) {
    return [];
  }

  const { scheme, path: sourcePath } = splitUri(sourceUri);
  const sourceDir = dirname(sourcePath);
  const basePath = joinRelativePath(sourceDir, specifier);

  const hasKnownExtension = KNOWN_FILE_EXTENSIONS.some((ext) =>
    basePath.toLowerCase().endsWith(ext)
  );

  const candidates: string[] = [];
  if (hasKnownExtension) {
    candidates.push(basePath);
  } else {
    for (const ext of RESOLVE_EXTENSIONS) {
      candidates.push(`${basePath}${ext}`);
    }
    for (const ext of RESOLVE_EXTENSIONS.slice(0, 4)) {
      candidates.push(`${basePath}/index${ext}`);
    }
  }

  return candidates.map((candidate) => `${scheme}${candidate}`);
}

/**
 * Score an import's relationship strength against the current completion
 * target: referenced named/default bindings rank highest, bare side-effect
 * imports rank lowest.
 */
export function computeImportScore(parsed: ParsedImport, targetTokens: ReadonlySet<string>): number {
  const referencedCount = parsed.names.filter((name) => targetTokens.has(name)).length;

  switch (parsed.kind) {
    case "named":
      return referencedCount > 0 ? IMPORT_SCORE.REFERENCED_NAMED : IMPORT_SCORE.NAMED;
    case "default":
      return referencedCount > 0 ? IMPORT_SCORE.REFERENCED_DEFAULT : IMPORT_SCORE.DEFAULT;
    case "namespace":
      return IMPORT_SCORE.NAMESPACE;
    case "sideEffect":
      return IMPORT_SCORE.SIDE_EFFECT;
    default:
      return ContextPriority.BACKGROUND;
  }
}

/**
 * Context provider resolving imports from the active TypeScript/JavaScript
 * file to workspace files and emitting symbol definition chunks scored by
 * import relationship strength. Retrieval is non-blocking and abort-aware.
 */
export class ImportDefinitionResolver implements ContextProvider {
  readonly id = "import-resolver";
  readonly name = "Import/Definition Resolver";
  readonly priority = ContextPriority.HIGH;

  private readonly fileAccess: ImportFileAccess;
  private readonly options: ImportResolverOptions;

  constructor(fileAccess: ImportFileAccess, options: Partial<ImportResolverOptions> = {}) {
    this.fileAccess = fileAccess;
    this.options = { ...DEFAULT_IMPORT_RESOLVER_OPTIONS, ...options };
  }

  /**
   * Check whether this provider applies to the given target:
   * only TypeScript/JavaScript family documents carry resolvable imports.
   */
  isAvailable(target: ContextTarget): boolean {
    const lang = normalizeLanguageId(target.language);
    return lang === "typescript" || lang === "javascript";
  }

  /**
   * Resolve imports and extract definition chunks within the given budget.
   */
  async getContext(
    target: ContextTarget,
    budget: ContextBudget,
    signal?: AbortSignal
  ): Promise<readonly ContextChunk[]> {
    const startTime = Date.now();

    if (signal?.aborted || !this.isAvailable(target)) {
      return [];
    }

    const fullText =
      target.fullText ?? `${target.prefix}\n${target.suffix}`;
    if (!fullText.trim()) {
      return [];
    }

    const lines = fullText.split("\n");
    const parsedImports = extractImportSpecifiers(lines).filter((parsed) =>
      isResolvableSpecifier(parsed.specifier)
    );
    if (parsedImports.length === 0) {
      return [];
    }

    const targetTokenSet = extractIdentifierTokens(`${target.prefix}\n${target.suffix}`);

    // Deduplicate multiple imports of the same specifier, keeping the first
    // (strongest) occurrence, then cap at maxImports
    const seenSpecifiers = new Set<string>();
    const selectedImports: Array<{ parsed: ParsedImport; score: number }> = [];
    for (const parsed of parsedImports) {
      if (seenSpecifiers.has(parsed.specifier)) continue;
      seenSpecifiers.add(parsed.specifier);

      const score = computeImportScore(parsed, targetTokenSet);
      selectedImports.push({ parsed, score });
      if (selectedImports.length >= this.options.maxImports) break;
    }

    const seenUris = new Set<string>();
    const chunks: ContextChunk[] = [];

    for (const { parsed, score } of selectedImports) {
      if (signal?.aborted) break;
      if (score < this.options.minImportScore) continue;

      const candidates = resolveImportCandidates(parsed.specifier, target.documentUri);
      if (candidates.length === 0) continue;

      const existing = await this.fileAccess.findExisting(candidates);
      const resolvedUri = existing[0];
      if (!resolvedUri || seenUris.has(resolvedUri)) continue;
      if (signal?.aborted) break;

      const text = await this.fileAccess.readText(resolvedUri);
      if (!text || !text.trim()) continue;
      seenUris.add(resolvedUri);

      // Prefer symbols explicitly imported by name, then remaining top-level symbols
      const importedNameSet = new Set(parsed.names);
      const allSymbols = extractTopLevelSymbols(text.split("\n"), this.options.maxSymbolsPerFile);
      const matched = allSymbols.filter((symbol) => importedNameSet.has(symbol.symbolName));
      const rest = allSymbols.filter((symbol) => !importedNameSet.has(symbol.symbolName));
      const ranked = [...matched, ...rest].slice(0, this.options.maxSymbolsPerFile);

      for (let symIndex = 0; symIndex < ranked.length; symIndex++) {
        const symbol = ranked[symIndex];

        let content = symbol.content;
        if (budget.maxLinesPerChunk !== undefined) {
          const contentLines = content.split("\n");
          if (contentLines.length > budget.maxLinesPerChunk) {
            content = contentLines.slice(0, budget.maxLinesPerChunk).join("\n");
          }
        }
        if (budget.maxTokensPerChunk !== undefined && estimateTokenCount(content) > budget.maxTokensPerChunk) {
          content = content.slice(0, budget.maxTokensPerChunk * 4);
        }

        chunks.push({
          id: `${this.id}-${seenUris.size}-${symIndex}`,
          type: "definition",
          uri: resolvedUri,
          content,
          score: Math.min(100, score),
          language: target.language,
          range: symbol.range,
          symbolName: symbol.symbolName,
          estimatedTokens: estimateTokenCount(content),
          metadata: {
            specifier: parsed.specifier,
            importKind: parsed.kind,
            importedNames: [...parsed.names],
            relationshipScore: score,
          },
        });
      }
    }

    const elapsed = Date.now() - startTime;
    if (elapsed > 20) {
      console.warn(`[ImportDefinitionResolver] Extraction took ${elapsed}ms (target <20ms)`);
    }

    return chunks;
  }
}
