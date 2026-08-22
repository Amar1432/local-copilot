/**
 * Context types and interfaces for the Local Copilot Context Engine.
 */

/**
 * Supported context chunk types
 */
export type ContextChunkType = "file" | "recent" | "import" | "definition";

/**
 * Standard priority weightings for context ranking
 */
export enum ContextPriority {
  CRITICAL = 100,
  HIGH = 75,
  MEDIUM = 50,
  LOW = 25,
  BACKGROUND = 10,
}

/**
 * Line and character position in a document
 */
export interface DocumentPosition {
  readonly line: number;
  readonly character: number;
}

/**
 * Range in a document
 */
export interface DocumentRange {
  readonly startLine: number;
  readonly endLine: number;
  readonly startCharacter?: number;
  readonly endCharacter?: number;
}

/**
 * Completion target information provided to context providers
 */
export interface ContextTarget {
  /** Document URI */
  readonly documentUri: string;
  /** Document version */
  readonly documentVersion: number;
  /** Programming language */
  readonly language: string;
  /** Cursor position */
  readonly position: DocumentPosition;
  /** Active code prefix before cursor */
  readonly prefix: string;
  /** Active code suffix after cursor */
  readonly suffix: string;
  /** Full text of current document (if available) */
  readonly fullText?: string;
  /** Root path of the workspace */
  readonly workspaceRoot?: string;
}

/**
 * An individual snippet of context extracted from code
 */
export interface ContextChunk {
  /** Unique chunk identifier */
  readonly id: string;
  /** Type classification of context chunk */
  readonly type: ContextChunkType;
  /** Source file URI or path */
  readonly uri: string;
  /** Raw content of the chunk */
  readonly content: string;
  /** Priority/relevance score (higher values = higher priority, e.g. 0 to 100) */
  readonly score: number;
  /** Programming language of the source file */
  readonly language?: string;
  /** Line and character range in the source file */
  readonly range?: DocumentRange;
  /** Name of the symbol if this chunk represents a definition/symbol */
  readonly symbolName?: string;
  /** Estimated token count */
  readonly estimatedTokens?: number;
  /** Additional arbitrary metadata */
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Budget constraints for context extraction and assembly
 */
export interface ContextBudget {
  /** Maximum total tokens allocated for all contextual chunks */
  readonly maxTokens: number;
  /** Maximum number of chunks to include */
  readonly maxChunks?: number;
  /** Maximum lines allowed in total across all chunks */
  readonly maxLines?: number;
  /** Maximum lines allowed per individual chunk */
  readonly maxLinesPerChunk?: number;
  /** Maximum tokens allowed per individual chunk */
  readonly maxTokensPerChunk?: number;
  /** Tokens reserved for prompt template and active prefix/suffix */
  readonly reservedTokens?: number;
}

/**
 * Interface that all context extractors/providers must implement
 */
export interface ContextProvider {
  /** Unique identifier for the context provider (e.g. "file", "recent-files", "import-resolver") */
  readonly id: string;
  /** Human-readable provider name */
  readonly name: string;
  /** Default priority weighting for chunks produced by this provider */
  readonly priority: number;
  /** Check if this provider is available for the given target */
  isAvailable?(target: ContextTarget): boolean | Promise<boolean>;
  /** Extract and return context chunks for the target within the given budget */
  getContext(
    target: ContextTarget,
    budget: ContextBudget,
    signal?: AbortSignal
  ): Promise<readonly ContextChunk[]>;
}
