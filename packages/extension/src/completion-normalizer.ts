/**
 * Completion Normalizer — cleans up raw model output before inserting
 * into the editor.
 *
 * Handles:
 * - Markdown code fence removal
 * - Explanatory prose removal
 * - Duplicate prefix/suffix detection
 * - Duplicate current-line detection
 * - Empty/whitespace-only result filtering
 * - Prompt label cleanup
 */

/**
 * Normalize raw model output into clean completion text.
 *
 * Returns null if the output should be discarded (empty, invalid, etc.).
 *
 * @param currentLine - The full text of the line the cursor is on. When
 *   provided, the normalizer can detect completions that duplicate existing
 *   content on the cursor line (e.g. after accepting a suggestion the model
 *   re-suggests the same text).
 */
export function normalizeCompletion(
  rawOutput: string,
  prefix: string,
  suffix: string,
  currentLine?: string
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

  // Step 3b: Remove a MULTI-LINE echo of the prefix. Weak local models (e.g.
  // qwen2.5-coder at end-of-file) re-emit a whole block of the file they were
  // given as context before generating anything new.
  text = removeMultiLinePrefixEcho(text, prefix);
  if (!text) return null;

  // Step 4: Remove duplicate suffix (model sometimes includes suffix)
  text = removeDuplicateSuffix(text, suffix);

  // Step 5: Remove duplicate of current line (model re-suggests accepted text)
  if (currentLine !== undefined) {
    text = removeDuplicateCurrentLine(text, currentLine);
  }

  // Step 6: Trim whitespace
  text = text.trim();

  // Step 7: Check if empty after cleanup
  if (!text) return null;

  // Step 8: Suppress completion if prefix already ends with this exact text
  // (prevents repeating code blocks/statements already written before the cursor)
  if (prefix) {
    const trimmedPrefix = prefix.trimEnd();
    if (trimmedPrefix.endsWith(text)) {
      return null;
    }
  }

  // Step 8b: Suppress a single-line completion that just repeats the last
  // non-empty line of the prefix (the "echo the line above" failure mode).
  if (!text.includes("\n")) {
    const lastPrefixLine = prefix
      .split("\n")
      .filter((l) => l.trim().length > 0)
      .pop();
    if (lastPrefixLine && text.trim() === lastPrefixLine.trim()) {
      return null;
    }
  }

  // Step 9: Check if it's just explanatory prose (heuristic)
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
 * Remove a multi-line echo of the prefix from the start of the output.
 *
 * Weak local models (qwen2.5-coder and similar) sometimes re-emit a block of
 * the file they were given as context — e.g. with the cursor at the end of a
 * file they regenerate the beginning of the file before continuing. This
 * strips the echoed lines and keeps only the genuine continuation.
 *
 * Conservative by design: only strips when the echoed run is clearly a repeat
 * (>= 4 lines matching contiguous prefix lines, and consuming >= 50% of the
 * completion), so legitimate completions are never truncated.
 */
function removeMultiLinePrefixEcho(text: string, prefix: string): string {
  const textLines = text.split("\n");
  if (textLines.length < 4) return text;
  if (!prefix) return text;
  const prefixLines = prefix.split("\n");
  if (prefixLines.length < 4) return text;

  // Find the longest contiguous run of completion lines (from the start of the
  // completion) that matches a contiguous run of prefix lines, whitespace- and
  // case-insensitively for the comparison.
  let longestRun = 0;
  for (let start = 0; start < prefixLines.length; start++) {
    let run = 0;
    while (
      start + run < prefixLines.length &&
      run < textLines.length &&
      textLines[run].trim().toLowerCase() === prefixLines[start + run].trim().toLowerCase()
    ) {
      run++;
    }
    if (run > longestRun) {
      longestRun = run;
    }
    if (run >= textLines.length) break;
  }

  // Only strip a clear echo: at least 4 lines, consuming at least half of the
  // completion. Smaller matches are handled by the single-line de-dup steps.
  if (longestRun < 4 || longestRun / textLines.length < 0.5) {
    return text;
  }

  return textLines.slice(longestRun).join("\n").trimStart();
}

/**
 * Remove duplicate of the current line content.
 *
 * After accepting a ghost-text suggestion the cursor moves to the end of
 * the accepted text. The model may then re-suggest the same text because
 * the cursor line is excluded from the prefix/suffix context sent to the
 * model. This step detects and strips that duplication.
 *
 * Handles two cases:
 * 1. Output ends with current-line text (model appended after cursor)
 * 2. Output starts with current-line text (model re-generated the line)
 */
function removeDuplicateCurrentLine(
  text: string,
  currentLine: string
): string {
  const trimmedLine = currentLine.trim();
  if (!trimmedLine) return text;

  // Strip leading newlines — models often prepend a newline before
  // re-generating the current line content.
  let stripped = text;
  while (stripped.charCodeAt(0) === 10) {
    stripped = stripped.slice(1);
  }

  // Case 1: output (after stripping leading newlines) ends with the
  // current line content — the model re-suggested what was just accepted.
  if (stripped.endsWith(trimmedLine)) {
    const candidate = stripped.slice(0, -trimmedLine.length).trimEnd();
    if (candidate) return candidate;
    return ""; // entire output was a duplicate
  }

  // Case 2: output starts with the current line content — the model
  // re-generated the entire line.
  if (stripped.startsWith(trimmedLine)) {
    const candidate = stripped.slice(trimmedLine.length);
    if (candidate.trim()) return candidate;
    return ""; // entire output was a duplicate
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
