/**
 * Similarity and Metric Calculations for Benchmark Evaluation
 */

import type { PercentileMetrics } from "./evaluation.types";

/**
 * Compute the Levenshtein edit distance between two strings.
 */
export function computeLevenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const aLen = a.length;
  const bLen = b.length;
  let prevRow = new Array<number>(bLen + 1);
  let currRow = new Array<number>(bLen + 1);

  for (let j = 0; j <= bLen; j++) {
    prevRow[j] = j;
  }

  for (let i = 1; i <= aLen; i++) {
    currRow[0] = i;
    const aChar = a[i - 1];

    for (let j = 1; j <= bLen; j++) {
      const cost = aChar === b[j - 1] ? 0 : 1;
      currRow[j] = Math.min(
        prevRow[j] + 1, // deletion
        currRow[j - 1] + 1, // insertion
        prevRow[j - 1] + cost // substitution
      );
    }

    // Swap rows
    const temp = prevRow;
    prevRow = currRow;
    currRow = temp;
  }

  return prevRow[bLen];
}

/**
 * Compute normalized character-level similarity in the range [0.0, 1.0].
 * 1.0 indicates identical strings, 0.0 indicates completely disjoint strings.
 */
export function computeNormalizedSimilarity(a: string, b: string): number {
  const normA = a.trim();
  const normB = b.trim();

  if (normA === normB) return 1.0;
  const maxLen = Math.max(normA.length, normB.length);
  if (maxLen === 0) return 1.0;

  const distance = computeLevenshteinDistance(normA, normB);
  return Math.max(0.0, 1.0 - distance / maxLen);
}

/**
 * Check if the generated completion is an exact match with the expected text (after trimming).
 */
export function isExactMatch(generated: string | null, expected?: string): boolean {
  if (generated === null || expected === undefined) return false;
  return generated.trim() === expected.trim();
}

/**
 * Check if the generated completion is a non-empty prefix of the expected text or vice-versa.
 */
export function isPrefixMatch(generated: string | null, expected?: string): boolean {
  if (generated === null || expected === undefined) return false;
  const genTrim = generated.trim();
  const expTrim = expected.trim();
  if (genTrim.length === 0 || expTrim.length === 0) return false;

  return expTrim.startsWith(genTrim) || genTrim.startsWith(expTrim);
}

/**
 * Compute token-level Jaccard similarity between two code snippets.
 */
export function computeTokenJaccard(a: string, b: string): number {
  const tokensA = new Set(a.match(/\b\w+\b|[^\s\w]/g) || []);
  const tokensB = new Set(b.match(/\b\w+\b|[^\s\w]/g) || []);

  if (tokensA.size === 0 && tokensB.size === 0) return 1.0;
  if (tokensA.size === 0 || tokensB.size === 0) return 0.0;

  let intersectionCount = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) {
      intersectionCount++;
    }
  }

  const unionCount = tokensA.size + tokensB.size - intersectionCount;
  return unionCount === 0 ? 1.0 : intersectionCount / unionCount;
}

/**
 * Compute percentile metrics (P50, P90, P95, P99, mean, median, min, max) for a list of numbers.
 */
export function computePercentiles(values: readonly number[]): PercentileMetrics {
  if (values.length === 0) {
    return {
      min: 0,
      max: 0,
      mean: 0,
      median: 0,
      p50: 0,
      p90: 0,
      p95: 0,
      p99: 0,
    };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const sum = sorted.reduce((acc, val) => acc + val, 0);
  const mean = Math.round((sum / n) * 100) / 100;

  const getPercentile = (p: number): number => {
    if (n === 1) return sorted[0];
    const index = (p / 100) * (n - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;
    if (lower === upper) return sorted[lower];
    return Math.round((sorted[lower] * (1 - weight) + sorted[upper] * weight) * 100) / 100;
  };

  return {
    min: sorted[0],
    max: sorted[n - 1],
    mean,
    median: getPercentile(50),
    p50: getPercentile(50),
    p90: getPercentile(90),
    p95: getPercentile(95),
    p99: getPercentile(99),
  };
}
