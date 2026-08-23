/**
 * Completion Orchestrator — coordinates the entire completion pipeline:
 *
 * 1. Receive editor completion request
 * 2. Check if request should be processed
 * 3. Schedule with debounce + cancellation
 * 4. Gather multi-file context from registered providers
 * 5. Deduplicate and apply budget constraints
 * 6. Build context from document
 * 7. Call provider to get completion
 * 8. Normalize the output
 * 9. Return clean completion items
 */

import type { ProviderConfig } from "@private-copilot/shared";
import type {
  ContextProvider,
  ContextTarget,
  ContextBudget,
  ContextChunk,
} from "@private-copilot/core";
import {
  BUDGET_PRESETS,
  deduplicateChunks,
  rankAndFilterChunks,
  serializeContextChunks,
  CompletionMetricsTracker,
} from "@private-copilot/core";
import { buildCompletionRequest, computeFingerprint, generateRequestId } from "./context-engine";
import { complete, testConnection } from "./openai-provider";
import { normalizeCompletion } from "./completion-normalizer";
import { RequestScheduler } from "./request-scheduler";
import { RequestCache, type CacheStats } from "./request-cache";

/**
 * The orchestrator's connection state.
 */
export type OrchestratorState = "idle" | "connected" | "disconnected" | "checking";

/**
 * Completion Orchestrator — manages the full completion lifecycle.
 */
export class CompletionOrchestrator {
  private scheduler: RequestScheduler;
  private cache: RequestCache<string>;
  private config: ProviderConfig;
  private state: OrchestratorState = "idle";
  private lastLatencyMs: number | null = null;
  private contextProviders: ContextProvider[];
  private metricsTracker: CompletionMetricsTracker;

  constructor(
    config: ProviderConfig,
    cacheOptions?: { maxSize?: number; defaultTtlMs?: number },
    contextProviders: ContextProvider[] = [],
    metricsTracker?: CompletionMetricsTracker
  ) {
    this.config = config;
    this.scheduler = new RequestScheduler(config.debounceMs);
    this.cache = new RequestCache<string>(cacheOptions);
    this.contextProviders = [...contextProviders];
    this.metricsTracker = metricsTracker ?? new CompletionMetricsTracker();
  }

  /**
   * Update the orchestrator configuration.
   */
  updateConfig(config: ProviderConfig): void {
    this.config = config;
    this.scheduler.dispose();
    this.scheduler = new RequestScheduler(config.debounceMs);
  }

  /**
   * Set the context providers used for multi-file context gathering.
   */
  setContextProviders(providers: ContextProvider[]): void {
    this.contextProviders = [...providers];
  }

  /**
   * Get the current connection state.
   */
  get connectionState(): OrchestratorState {
    return this.state;
  }

  /**
   * Get the last request latency.
   */
  get latencyMs(): number | null {
    return this.lastLatencyMs;
  }

  /**
   * Get the completion metrics tracker instance.
   */
  get metrics(): CompletionMetricsTracker {
    return this.metricsTracker;
  }

  /**
   * Gather context chunks from all registered providers, deduplicate,
   * apply budget constraints, and serialize into a prompt-ready string.
   *
   * Returns the serialized context text, or null if no context was gathered.
   */
  private async gatherContext(
    target: ContextTarget,
    budget: ContextBudget,
    signal?: AbortSignal
  ): Promise<string | null> {
    if (this.contextProviders.length === 0) {
      return null;
    }

    // Collect chunks from all providers concurrently
    const providerResults = await Promise.all(
      this.contextProviders.map(async (provider) => {
        try {
          if (provider.isAvailable) {
            const available = await provider.isAvailable(target);
            if (!available) return [];
          }
          return await provider.getContext(target, budget, signal);
        } catch {
          return [];
        }
      })
    );

    // Flatten all chunks
    const allChunks: ContextChunk[] = providerResults.flat();

    if (allChunks.length === 0) {
      return null;
    }

    // Step 1: Deduplicate chunks (symbol-based + content similarity)
    const deduplicated = deduplicateChunks(allChunks);

    // Step 2: Apply budget constraints (rank by score, enforce token/chunk limits)
    const budgeted = rankAndFilterChunks(deduplicated, budget);

    if (budgeted.length === 0) {
      return null;
    }

    // Step 3: Serialize into prompt-ready text
    return serializeContextChunks(budgeted, {
      format: "xml",
      wrapInBlock: true,
      includeMetadata: false,
    });
  }

  /**
   * Resolve the context budget from the configured preset name.
   */
  private resolveBudget(): ContextBudget {
    const presetName = this.config.contextBudgetPreset ?? "balanced";
    const preset = BUDGET_PRESETS.get(presetName) ?? BUDGET_PRESETS.get("balanced")!;

    return {
      maxTokens: preset.maxTokens,
      maxChunks: preset.maxChunks,
      maxLines: preset.maxLines,
      maxLinesPerChunk: preset.maxLinesPerChunk,
      maxTokensPerChunk: preset.maxTokensPerChunk,
      reservedTokens: preset.reservedTokens,
    };
  }

  /**
   * Request a completion from the orchestrator.
   *
   * Returns the normalized completion text, or null if no completion
   * should be shown.
   */
  async requestCompletion(params: {
    readonly documentUri: string;
    readonly documentVersion: number;
    readonly language: string;
    readonly fullText: string;
    readonly cursorLine: number;
    readonly cursorCharacter: number;
    readonly cancellationToken?: { readonly isCancellationRequested: boolean };
  }): Promise<string | null> {
    // Skip if disabled or no model configured
    if (!this.config.enabled || !this.config.model) {
      return null;
    }

    this.metricsTracker.recordRequest({
      language: params.language,
      provider: this.config.provider,
      model: this.config.model,
    });

    // Skip if already cancelled
    if (params.cancellationToken?.isCancellationRequested) {
      this.metricsTracker.recordCancellation({ language: params.language });
      return null;
    }

    // Build the completion request context
    const request = buildCompletionRequest({
      documentUri: params.documentUri,
      documentVersion: params.documentVersion,
      language: params.language,
      fullText: params.fullText,
      cursorLine: params.cursorLine,
      cursorCharacter: params.cursorCharacter,
      maxLines: this.config.contextMaxLines,
    });

    // Compute request fingerprint for cache lookup & deduplication
    const fingerprint = computeFingerprint({
      documentVersion: params.documentVersion,
      line: params.cursorLine,
      character: params.cursorCharacter,
      prefix: request.prefix,
      suffix: request.suffix,
      model: this.config.model,
    });

    // Check L1 Request Cache
    const cached = this.cache.get(fingerprint);
    if (cached !== null) {
      this.metricsTracker.recordCacheHit({ language: params.language, latencyMs: 0 });
      this.metricsTracker.recordSuccess({
        latencyMs: 0,
        text: cached,
        language: params.language,
        provider: this.config.provider,
        model: this.config.model,
        cached: true,
      });
      return cached;
    }
    this.metricsTracker.recordCacheMiss({ language: params.language });

    // Schedule with debounce + cancellation
    const requestId = generateRequestId();
    const signal = this.scheduler.schedule({
      requestId,
      documentVersion: params.documentVersion,
      line: params.cursorLine,
      character: params.cursorCharacter,
      prefix: request.prefix,
      suffix: request.suffix,
      model: this.config.model,
    });

    if (signal === null) {
      this.metricsTracker.recordCancellation({ language: params.language });
      return null;
    }

    try {
      // Wait for the debounced signal, then call the provider
      const abortSignal = await signal;

      // Check cancellation after debounce
      if (abortSignal.aborted || params.cancellationToken?.isCancellationRequested) {
        this.metricsTracker.recordCancellation({ language: params.language });
        return null;
      }

      // Gather multi-file context from registered providers
      const budget = this.resolveBudget();
      const target: ContextTarget = {
        documentUri: params.documentUri,
        documentVersion: params.documentVersion,
        language: params.language,
        position: { line: params.cursorLine, character: params.cursorCharacter },
        prefix: request.prefix,
        suffix: request.suffix,
        fullText: params.fullText,
      };

      const contextText = await this.gatherContext(target, budget, abortSignal);

      // Build the request with context included
      const enrichedRequest = {
        ...request,
        contextText: contextText ?? undefined,
      };

      // Call the provider
      const result = await complete(enrichedRequest, this.config, abortSignal);

      // Mark request as completed
      this.scheduler.markCompleted(requestId);

      if (result === null) {
        this.metricsTracker.recordFailure({
          message: "No completion returned from provider",
          language: params.language,
          provider: this.config.provider,
        });
        return null;
      }

      // Track latency
      this.lastLatencyMs = result.latencyMs;

      // Extract the current line for duplicate detection in the normalizer.
      // buildCompletionRequest excludes the cursor line from both prefix and
      // suffix, so the normalizer needs it separately to detect re-suggestions.
      const lines = params.fullText.split("\n");
      const currentLine = lines[params.cursorLine] ?? "";

      // Normalize the output
      const normalized = normalizeCompletion(
        result.text,
        request.prefix,
        request.suffix,
        currentLine
      );

      // Store in L1 Request Cache if valid
      if (normalized !== null) {
        this.cache.set(fingerprint, normalized);
        this.metricsTracker.recordSuccess({
          latencyMs: result.latencyMs,
          text: normalized,
          language: params.language,
          provider: this.config.provider,
          model: this.config.model,
          cached: false,
        });
      } else {
        this.metricsTracker.recordDismissal({ language: params.language });
      }

      return normalized;
    } catch (err) {
      this.scheduler.markCompleted(requestId);
      this.metricsTracker.recordFailure({
        message: err instanceof Error ? err.message : String(err),
        language: params.language,
        provider: this.config.provider,
      });
      return null;
    }
  }

  /**
   * Clear the in-memory completion cache.
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get L1 cache statistics.
   */
  get cacheStats(): CacheStats {
    return this.cache.stats;
  }

  /**
   * Test the connection to the configured provider.
   */
  async testProviderConnection(): Promise<boolean> {
    this.state = "checking";
    const connected = await testConnection(this.config);
    this.state = connected ? "connected" : "disconnected";
    return connected;
  }

  /**
   * Cancel any in-flight completion request.
   */
  cancel(): void {
    this.scheduler.cancel();
  }

  /**
   * Dispose of the orchestrator.
   */
  dispose(): void {
    this.scheduler.dispose();
  }
}
