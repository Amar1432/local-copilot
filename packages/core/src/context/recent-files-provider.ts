/**
 * RecentFilesProvider — tracks recently opened/edited documents in an
 * in-memory LRU buffer and extracts relevant top-level symbol chunks from
 * them as multi-file context for completions.
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
 * A tracked snapshot of a recently active document.
 */
export interface RecentFileEntry {
  /** Document URI */
  readonly uri: string;
  /** Programming language identifier */
  readonly language: string;
  /** Text snapshot captured when the document was last recorded */
  readonly text: string;
  /** Epoch milliseconds of the last recording */
  readonly lastActiveAt: number;
}

/**
 * Parameters used to record a document into the recent files buffer.
 */
export interface RecordRecentFileParams {
  readonly uri: string;
  readonly language: string;
  readonly text: string;
}

/**
 * Configuration options for RecentFilesBuffer and RecentFilesProvider.
 */
export interface RecentFilesOptions {
  /** Maximum number of documents kept in the LRU buffer */
  maxEntries: number;
  /** Maximum number of recent files considered per completion request */
  maxFiles: number;
  /** Maximum symbol chunks extracted per recent file */
  maxSymbolsPerFile: number;
  /** Maximum lines included per extracted symbol chunk */
  maxLinesPerSymbol: number;
  /** Score decay applied per LRU recency position (0 = most recent) */
  recencyDecayStep: number;
  /** Weight (0-1) of the recency component in the final chunk score */
  recencyWeight: number;
  /** Minimum combined score required to emit chunks from a file */
  minRelevanceScore: number;
  /** Only consider recent files whose language matches the target */
  matchLanguage: boolean;
}

/**
 * Default configuration for recent file tracking and extraction.
 */
export const DEFAULT_RECENT_FILES_OPTIONS: RecentFilesOptions = {
  maxEntries: 20,
  maxFiles: 5,
  maxSymbolsPerFile: 3,
  maxLinesPerSymbol: 15,
  recencyDecayStep: 10,
  recencyWeight: 0.5,
  minRelevanceScore: ContextPriority.BACKGROUND,
  matchLanguage: true,
};

/**
 * Regex patterns for top-level symbol declarations across supported languages
 */
const TOP_LEVEL_SYMBOL_PATTERNS = [
  /^(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+([\w$]+)/,
  /^(?:export\s+)?interface\s+([\w$]+)/,
  /^(?:export\s+)?(?:async\s+)?function\s*([\w$]+)?\s*\(/,
  /^(?:export\s+)?(?:const|let|var)\s+([\w$]+)\s*(?::[^=]+)?=\s*(?:async\s*)?(?:\([^)]*\)|[\w$]+)\s*=>/,
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
  /^(?:public|protected|private)\s+(?:static\s+)?(?:final\s+)?(?:synchronized\s+)?(?:[\w<>[\\],\\s]+)\s+([\w$]+)\s*\([^)]*\)/,
];

/**
 * Normalize language identifier so recent-file matching is consistent
 */
export function normalizeLanguageId(lang: string): string {
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
 * In-memory LRU buffer of recently active documents with recency timestamps.
 * Purely synchronous and bounded — evicts least-recently-used entries first.
 */
export class RecentFilesBuffer {
  private readonly entries: Map<string, RecentFileEntry>;
  private readonly maxEntries: number;
  private readonly now: () => number;

  constructor(maxEntries = DEFAULT_RECENT_FILES_OPTIONS.maxEntries, now: () => number = Date.now) {
    this.entries = new Map();
    this.maxEntries = Math.max(1, maxEntries);
    this.now = now;
  }

  /**
   * Record or refresh a document snapshot. Re-recording moves the entry to
   * the most-recent position and updates its timestamp.
   */
  record(params: RecordRecentFileParams): RecentFileEntry {
    // Delete first so re-insertion refreshes Map insertion order (LRU behavior)
    this.entries.delete(params.uri);

    const entry: RecentFileEntry = {
      uri: params.uri,
      language: params.language,
      text: params.text,
      lastActiveAt: this.now(),
    };

    this.entries.set(entry.uri, entry);

    while (this.entries.size > this.maxEntries) {
      const oldestKey = this.entries.keys().next().value;
      if (oldestKey === undefined) break;
      this.entries.delete(oldestKey);
    }

    return entry;
  }

  /**
   * Remove a document from tracking (e.g. editor closed). Returns true if removed.
   */
  remove(uri: string): boolean {
    return this.entries.delete(uri);
  }

  /**
   * Get a tracked snapshot without affecting recency order.
   */
  get(uri: string): RecentFileEntry | undefined {
    return this.entries.get(uri);
  }

  /**
   * All tracked entries ordered most-recent-first.
   */
  list(): readonly RecentFileEntry[] {
    return [...this.entries.values()].reverse();
  }

  /**
   * Number of currently tracked documents.
   */
  get size(): number {
    return this.entries.size;
  }

  /**
   * Clear all tracked documents.
   */
  clear(): void {
    this.entries.clear();
  }
}

/**
 * Extract top-level symbol declarations (functions, classes, interfaces,
 * types, structs) from document lines, up to maxCount symbols.
 */
export function extractTopLevelSymbols(
  lines: readonly string[],
  maxCount = DEFAULT_RECENT_FILES_OPTIONS.maxSymbolsPerFile
): Array<{ content: string; range: DocumentRange; symbolName: string }> {
  const symbols: Array<{ content: string; range: DocumentRange; symbolName: string }> = [];

  for (let i = 0; i < lines.length && symbols.length < maxCount; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) continue;

    let symbolName: string | undefined;
    for (const pattern of TOP_LEVEL_SYMBOL_PATTERNS) {
      const match = line.match(pattern);
      if (match) {
        symbolName = match[1] || undefined;
        break;
      }
    }
    if (!symbolName) continue;

    const chunkLines: string[] = [line];
    let bracketDepth = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;

    for (
      let j = i + 1;
      j < lines.length && chunkLines.length < DEFAULT_RECENT_FILES_OPTIONS.maxLinesPerSymbol;
      j++
    ) {
      const nextLine = lines[j];
      chunkLines.push(nextLine);
      bracketDepth += (nextLine.match(/\{/g) || []).length - (nextLine.match(/\}/g) || []).length;
      if (bracketDepth <= 0 && (nextLine.includes("}") || nextLine.includes(";"))) {
        break;
      }
    }

    symbols.push({
      content: chunkLines.join("\n"),
      range: { startLine: i + 1, endLine: i + chunkLines.length },
      symbolName,
    });
  }

  return symbols;
}

/**
 * Extract identifier-like tokens (length >= 3) from code text.
 * Used for lightweight lexical relevance scoring.
 */
export function extractIdentifierTokens(text: string): Set<string> {
  const tokens = new Set<string>();
  const matches = text.match(/[A-Za-z_$][\w$]{2,}/g);
  if (matches) {
    for (const token of matches) {
      tokens.add(token);
    }
  }
  return tokens;
}

/**
 * Compute lexical relevance (0-100) between a target text and candidate text
 * based on identifier token overlap relative to the target vocabulary.
 */
export function computeLexicalRelevance(targetText: string, candidateText: string): number {
  const targetTokens = extractIdentifierTokens(targetText);
  if (targetTokens.size === 0) {
    return 0;
  }

  const candidateTokens = extractIdentifierTokens(candidateText);
  let overlap = 0;
  for (const token of targetTokens) {
    if (candidateTokens.has(token)) {
      overlap++;
    }
  }

  return Math.round((overlap / targetTokens.size) * 100);
}

/**
 * Compute a recency score (0-100) for a file at the given LRU position,
 * where position 0 is the most recently active file.
 */
export function computeRecencyScore(position: number, decayStep = DEFAULT_RECENT_FILES_OPTIONS.recencyDecayStep): number {
  return Math.max(0, 100 - position * decayStep);
}

/**
 * Combine recency and lexical scores into a single weighted score (0-100).
 */
export function combineScores(
  recencyScore: number,
  lexicalScore: number,
  recencyWeight = DEFAULT_RECENT_FILES_OPTIONS.recencyWeight
): number {
  const clampedWeight = Math.min(1, Math.max(0, recencyWeight));
  return Math.round(clampedWeight * recencyScore + (1 - clampedWeight) * lexicalScore);
}

/**
 * Context provider producing chunks from recently active files.
 * Chunks are scored by a blend of LRU recency and lexical relevance to the
 * current completion target. Retrieval is non-blocking and abort-aware.
 */
export class RecentFilesProvider implements ContextProvider {
  readonly id = "recent-files";
  readonly name = "Recent Files Provider";
  readonly priority = ContextPriority.MEDIUM;

  private readonly buffer: RecentFilesBuffer;
  private readonly options: RecentFilesOptions;

  constructor(
    buffer: RecentFilesBuffer,
    options: Partial<RecentFilesOptions> = {}
  ) {
    this.buffer = buffer;
    this.options = { ...DEFAULT_RECENT_FILES_OPTIONS, ...options };
  }

  /**
   * Check whether any usable recent files exist for the target.
   */
  isAvailable(target: ContextTarget): boolean {
    const candidates = this.buffer.list().filter((entry) => {
      if (entry.uri === target.documentUri) return false;
      if (entry.text.trim() === "") return false;
      if (
        this.options.matchLanguage &&
        normalizeLanguageId(entry.language) !== normalizeLanguageId(target.language)
      ) {
        return false;
      }
      return true;
    });

    return candidates.length > 0;
  }

  /**
   * Extract context chunks from recent files within the given budget.
   */
  async getContext(
    target: ContextTarget,
    budget: ContextBudget,
    signal?: AbortSignal
  ): Promise<readonly ContextChunk[]> {
    const startTime = Date.now();

    if (signal?.aborted) {
      return [];
    }

    const targetText = `${target.prefix}\n${target.suffix}`;
    const candidates: Array<{ entry: RecentFileEntry; position: number; lexicalScore: number }> = [];

    const entries = this.buffer.list();
    let position = 0;
    for (const entry of entries) {
      if (entry.uri === target.documentUri) continue;
      if (
        this.options.matchLanguage &&
        normalizeLanguageId(entry.language) !== normalizeLanguageId(target.language)
      ) {
        continue;
      }
      candidates.push({
        entry,
        position,
        lexicalScore: computeLexicalRelevance(targetText, entry.text),
      });
      position++;
    }

    // Most-recent files first; keep only the configured maximum
    const selected = candidates.slice(0, this.options.maxFiles);
    const targetTokenSet = extractIdentifierTokens(targetText);
    const chunks: ContextChunk[] = [];

    for (let fileIndex = 0; fileIndex < selected.length; fileIndex++) {
      if (signal?.aborted) {
        break;
      }

      const { entry, position: recencyPosition, lexicalScore } = selected[fileIndex];
      const recencyScore = computeRecencyScore(recencyPosition, this.options.recencyDecayStep);
      const fileScore = combineScores(recencyScore, lexicalScore, this.options.recencyWeight);

      if (fileScore < this.options.minRelevanceScore) {
        continue;
      }

      const lines = entry.text.split("\n");
      const symbols = extractTopLevelSymbols(lines, this.options.maxSymbolsPerFile);

      for (let symIndex = 0; symIndex < symbols.length; symIndex++) {
        const symbol = symbols[symIndex];

        let content = symbol.content;
        const maxLines =
          budget.maxLinesPerChunk ?? this.options.maxLinesPerSymbol;
        const contentLines = content.split("\n");
        if (contentLines.length > maxLines) {
          content = contentLines.slice(0, maxLines).join("\n");
        }
        if (budget.maxTokensPerChunk !== undefined) {
          const tokens = estimateTokenCount(content);
          if (tokens > budget.maxTokensPerChunk) {
            content = content.slice(0, budget.maxTokensPerChunk * 4);
          }
        }

        // Symbol names referenced by the current target get a relevance boost
        const symbolBoost = targetTokenSet.has(symbol.symbolName) ? 5 : 0;
        const score = Math.min(100, fileScore + symbolBoost);

        chunks.push({
          id: `${this.id}-${fileIndex}-${symIndex}`,
          type: "recent",
          uri: entry.uri,
          content,
          score,
          language: entry.language,
          range: symbol.range,
          symbolName: symbol.symbolName,
          estimatedTokens: estimateTokenCount(content),
          metadata: {
            recencyPosition,
            lastActiveAt: entry.lastActiveAt,
            recencyScore,
            lexicalScore,
          },
        });
      }
    }

    const elapsed = Date.now() - startTime;
    if (elapsed > 20) {
      console.warn(`[RecentFilesProvider] Extraction took ${elapsed}ms (target <20ms)`);
    }

    return chunks;
  }
}
