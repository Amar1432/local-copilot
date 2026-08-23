/**
 * Fill-in-the-Middle (FIM) formatting and token definitions for various LLMs.
 */

export interface FimTokens {
  readonly prefix: string;
  readonly suffix: string;
  readonly middle: string;
}

export const FIM_TEMPLATES: Record<string, FimTokens> = {
  default: {
    prefix: "<PRE>",
    suffix: "<SUF>",
    middle: "<MID>",
  },
  qwen: {
    prefix: "<|fim_prefix|>",
    suffix: "<|fim_suffix|>",
    middle: "<|fim_middle|>",
  },
  deepseek: {
    prefix: "<｜fim begin｜>",
    suffix: "<｜fim hole｜>",
    middle: "<｜fim end｜>",
  },
  starcoder: {
    prefix: "<fim_prefix>",
    suffix: "<fim_suffix>",
    middle: "<fim_middle>",
  },
  codellama: {
    prefix: " <PRE>",
    suffix: " <SUF>",
    middle: " <MID>",
  },
};

/**
 * Detect or resolve FIM tokens for a given model or template identifier.
 */
export function getFimTokens(modelOrTemplate?: string): FimTokens {
  if (!modelOrTemplate) {
    return FIM_TEMPLATES.default;
  }

  const lower = modelOrTemplate.toLowerCase();

  if (FIM_TEMPLATES[lower]) {
    return FIM_TEMPLATES[lower];
  }

  if (lower.includes("qwen")) {
    return FIM_TEMPLATES.qwen;
  }
  if (lower.includes("deepseek")) {
    return FIM_TEMPLATES.deepseek;
  }
  if (lower.includes("starcoder") || lower.includes("codegemma")) {
    return FIM_TEMPLATES.starcoder;
  }
  if (lower.includes("codellama") || lower.includes("llama")) {
    return FIM_TEMPLATES.codellama;
  }

  return FIM_TEMPLATES.default;
}

/**
 * Build a FIM prompt given prefix, suffix, and optional token set / model identifier.
 */
export function formatFimPrompt(
  prefix: string,
  suffix: string,
  templateOrTokens?: string | FimTokens,
  options?: { readonly fileName?: string; readonly language?: string }
): string {
  const tokens =
    typeof templateOrTokens === "object"
      ? templateOrTokens
      : getFimTokens(templateOrTokens);

  let formattedPrefix = prefix;
  if (options?.fileName && !prefix.includes(options.fileName)) {
    const templateName = typeof templateOrTokens === "string" ? templateOrTokens.toLowerCase() : "";
    if (templateName.includes("qwen")) {
      formattedPrefix = `<|file_sep|>${options.fileName}\n${prefix}`;
    }
  }

  return `${tokens.prefix}${formattedPrefix}${tokens.suffix}${suffix}${tokens.middle}`;
}

/**
 * Check if FIM is supported based on capabilities and model metadata.
 */
export function isFimSupported(
  model?: string,
  capabilities?: { readonly fim?: boolean }
): boolean {
  if (capabilities?.fim === false) {
    return false;
  }
  if (capabilities?.fim === true) {
    return true;
  }
  if (!model) {
    return false;
  }

  const lower = model.toLowerCase();
  return (
    lower.includes("coder") ||
    lower.includes("qwen") ||
    lower.includes("deepseek") ||
    lower.includes("starcoder") ||
    lower.includes("codellama") ||
    lower.includes("fim")
  );
}
