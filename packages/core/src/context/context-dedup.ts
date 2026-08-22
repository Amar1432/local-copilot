/**
 * Cross-file chunk deduplication. Removes duplicate context chunks that
 * represent the same symbol or nearly identical content, preserving the
 * highest-priority chunk in each duplicate group.
 */

import type { ContextChunk } from "./context.types";
import { extractIdentifierTokens } from "./recent-files-provider";

/**
 * Jaccard similarity threshold above which two token sets are considered
 * content duplicates (0-1).
 */
const DEFAULT_CONTENT_SIMILARITY_THRESHOLD = 0.85;

/**
 * Minimum identifier tokens required in both chunks before content
 * similarity dedup is considered. Prevents trivial overlap on tiny snippets.
 */
const MIN_TOKENS_FOR_CONTENT_DEDUP = 3;

/**
 * Normalise a chunk's content into a deterministic fingerprint string
 * derived from its sorted identifier tokens.
 */
function contentFingerprint(content: string): string {
  const tokens = extractIdentifierTokens(content);
  return [...tokens].sort().join("|");
}

/**
 * Jaccard similarity between two token sets.
 */
function jaccardSimilarity(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Stable sort comparator for chunks: score desc, then uri, then id.
 */
function chunkSortKey(chunk: ContextChunk): string {
  return `${String(1000 - chunk.score).padStart(4, "0")}:${chunk.uri}:${chunk.id}`;
}

/**
 * Deduplicate context chunks using two strategies applied in order:
 *
 * 1. **Symbol dedup** — chunks with the same `symbolName` are considered
 *    duplicates regardless of source URI; the highest-scored chunk wins.
 *
 * 2. **Content dedup** — remaining chunks without a symbol name whose
 *    identifier-token Jaccard similarity exceeds the threshold are
 *    considered duplicates; the highest-scored chunk wins.
 *
 * The result is sorted by score descending (deterministic via secondary
 * key on id).
 */
export function deduplicateChunks(
  chunks: readonly ContextChunk[],
  contentSimilarityThreshold = DEFAULT_CONTENT_SIMILARITY_THRESHOLD
): ContextChunk[] {
  if (chunks.length === 0) return [];

  // Sort deterministically before grouping so tie-breaking is stable
  const sorted = [...chunks].sort((a, b) => {
    const ka = chunkSortKey(a);
    const kb = chunkSortKey(b);
    return ka.localeCompare(kb);
  });

  // --- Pass 1: symbol-based dedup ---
  const bySymbol = new Map<string, ContextChunk>();
  const noSymbol: ContextChunk[] = [];

  for (const chunk of sorted) {
    if (chunk.symbolName) {
      const existing = bySymbol.get(chunk.symbolName);
      if (!existing || chunk.score > existing.score) {
        bySymbol.set(chunk.symbolName, chunk);
      }
    } else {
      noSymbol.push(chunk);
    }
  }

  // --- Pass 2: content-based dedup on remaining chunks ---
  const kept: ContextChunk[] = [...bySymbol.values()];
  const keptFingerprints: Array<{ fp: string; tokens: ReadonlySet<string>; chunk: ContextChunk }> = [];

  for (const chunk of noSymbol) {
    const fp = contentFingerprint(chunk.content);
    const tokens = extractIdentifierTokens(chunk.content);
    let isDup = false;

    for (const existing of keptFingerprints) {
      // Exact content match is always a duplicate
      if (chunk.content === existing.chunk.content) {
        if (chunk.score > existing.chunk.score) {
          const idx = kept.indexOf(existing.chunk);
          if (idx !== -1) kept[idx] = chunk;
          existing.fp = fp;
          existing.tokens = tokens;
          existing.chunk = chunk;
        }
        isDup = true;
        break;
      }

      if (
        tokens.size >= MIN_TOKENS_FOR_CONTENT_DEDUP &&
        existing.tokens.size >= MIN_TOKENS_FOR_CONTENT_DEDUP &&
        jaccardSimilarity(tokens, existing.tokens) >= contentSimilarityThreshold
      ) {
        // Keep higher score
        if (chunk.score > existing.chunk.score) {
          // Replace the existing entry
          const idx = kept.indexOf(existing.chunk);
          if (idx !== -1) kept[idx] = chunk;
          existing.fp = fp;
          existing.tokens = tokens;
          existing.chunk = chunk;
        }
        isDup = true;
        break;
      }
    }

    if (!isDup) {
      kept.push(chunk);
      keptFingerprints.push({ fp, tokens, chunk });
    }
  }

  // Final deterministic sort by score desc
  return kept.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.id.localeCompare(b.id);
  });
}
