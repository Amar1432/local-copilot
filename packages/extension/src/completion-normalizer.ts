/**
 * Completion Normalizer — cleans up raw model output before inserting
 * into the editor.
 *
 * Handles:
 * - Markdown code fence removal
 * - Explanatory prose removal
 * - Duplicate prefix/suffix detection
 * - Empty/whitespace-only result filtering
 * - Prompt label cleanup
 */

/**
 * Normalize raw model output into clean completion text.
 *
 * Returns null if the output should be discarded (empty, invalid, etc.).
 */
export function normalizeCompletion(
  rawOutput: string,
  prefix: string,
  suffix: string
): string | null {
  if (!rawOutput) return null;

  let text = rawOutput;

  // Step 1: Remove markdown code fences
  text = removeCodeFences(text);
  if (!text) return null;

  // Step 2: Remove prompt labels that leaked through
  text = removePromptLabels(text);
  if (!text) return null;

  // Step 3: Remove duplicate prefix (model often repeats the prefix)
  text = removeDuplicatePrefix(text, prefix);

  // Step 4: Remove duplicate suffix (model sometimes includes suffix)
  text = removeDuplicateSuffix(text, suffix);

  // Step 5: Trim whitespace
  text = text.trim();

  // Step 6: Check if empty after cleanup
  if (!text) return null;

  // Step 7: Check if it's just explanatory prose (heuristic)
  if (isLikelyProse(text)) return null;

  return text;
}

/**
 * Remove markdown code fences (``` ... ```).
 */
function removeCodeFences(text: string): string {
  // Remove opening fence with optional language tag
  let result = text.replace(/^```[\w]*\n?/gm, "");
  // Remove closing fence
  result = result.replace(/^```\s*$/gm, "");
  return result.trim();
}

/**
 * Remove prompt labels that may have leaked into the output.
 */
function removePromptLabels(text: string): string {
  const labels = [
    "<PREFIX>",
    "</PREFIX>",
    "<SUFFIX>",
    "</SUFFIX>",
    "<COMPLETION>",
    "</COMPLETION>",
    "<PRE>",
    "<SUF>",
    "<MID>",
  ];

  let result = text;
  for (const label of labels) {
    result = result.replaceAll(label, "");
  }
  return result.trim();
}

/**
 * Remove duplicate prefix if the model output starts with the prefix.
 */
function removeDuplicatePrefix(text: string, prefix: string): string {
  if (!prefix) return text;

  // Check if the output starts with the last line of the prefix
  const prefixLastLine = prefix.split("\n").pop() ?? "";
  if (prefixLastLine && text.startsWith(prefixLastLine)) {
    return text.slice(prefixLastLine.length);
  }

  return text;
}

/**
 * Remove duplicate suffix if the model output ends with the suffix.
 */
function removeDuplicateSuffix(text: string, suffix: string): string {
  if (!suffix) return text;

  // Check if the output ends with the trimmed suffix
  const trimmedSuffix = suffix.trim();
  if (trimmedSuffix && text.endsWith(trimmedSuffix)) {
    return text.slice(0, -trimmedSuffix.length).trimEnd();
  }

  // Also check the first line of the suffix
  const suffixFirstLine = suffix.split("\n").filter((l) => l.trim())[0] ?? "";
  if (suffixFirstLine && text.endsWith(suffixFirstLine)) {
    return text.slice(0, -suffixFirstLine.length).trimEnd();
  }

  return text;
}

/**
 * Heuristic to detect if text is explanatory prose rather than code.
 */
function isLikelyProse(text: string): boolean {
  const lines = text.split("\n");

  // If most lines start with common prose patterns, it's likely prose
  const prosePatterns = [
    /^(here|this|the|you|we|to|in|for|note|example|see|check|make|ensure)/i,
    /^(sure|ok|here's|here is|let me|i'll|you can|you should)/i,
    /^(this (will|would|should|can|is|completes|adds|creates))/i,
  ];

  let proseLineCount = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && prosePatterns.some((p) => p.test(trimmed))) {
      proseLineCount++;
    }
  }

  // If more than 50% of non-empty lines look like prose, discard
  const nonEmptyLines = lines.filter((l) => l.trim().length > 0).length;
  return nonEmptyLines > 0 && proseLineCount / nonEmptyLines > 0.5;
}
