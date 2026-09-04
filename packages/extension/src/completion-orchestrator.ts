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
  type RecordAcceptanceOptions,
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
  /**
   * A suggestion already delivered for a state may be re-served within this
   * window (covers VS Code re-firing the provider for the same state while the
   * ghost text is still on screen). After the window, a re-request of the same
   * state means the user saw and dismissed the suggestion — it must NOT come
   * back, otherwise the "same suggestion keeps reappearing" loop occurs.
   */
  private static readonly RE_DELIVER_GRACE_MS = 500;

  private scheduler: RequestScheduler;
  private cache: RequestCache<string>;
  private config: ProviderConfig;
  private state: OrchestratorState = "idle";
  private lastLatencyMs: number | null = null;
  private contextProviders: ContextProvider[];
  private metricsTracker: CompletionMetricsTracker;

  /** Fingerprint + delivery time of the last suggestion actually returned. */
  private lastDelivered: { readonly fingerprint: string; readonly at: number } | null = null;

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

    // A suggestion was already delivered for this exact state and the user has
    // had time to react to it (dismiss/accept). Re-requesting the same state
    // (e.g. VS Code re-fires after a rejected suggestion, or the cursor moved
    // away and back) must NOT surface the same suggestion again.
    if (
      this.lastDelivered !== null &&
      this.lastDelivered.fingerprint === fingerprint &&
      Date.now() - this.lastDelivered.at > CompletionOrchestrator.RE_DELIVER_GRACE_MS
    ) {
      this.metricsTracker.recordDismissal({ language: params.language });
      return null;
    }

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
      this.lastDelivered = { fingerprint, at: Date.now() };
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

      // The request may have been cancelled while the provider call was in
      // flight (e.g. the user kept typing). Providers that ignore abort can
      // still return a result — discard it so stale text is never displayed.
      if (abortSignal.aborted || params.cancellationToken?.isCancellationRequested) {
        this.metricsTracker.recordCancellation({ language: params.language });
        return null;
      }

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
        this.lastDelivered = { fingerprint, at: Date.now() };
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
   * Record that a delivered suggestion was accepted by the user.
   *
   * The accepted suggestion's cache entry is invalidated so it can never be
   * re-served — even if a stale re-request for the pre-acceptance state slips
   * through (e.g. VS Code firing the provider for the old document state).
   */
  handleAcceptance(options: RecordAcceptanceOptions): void {
    this.metricsTracker.recordAcceptance(options);
    if (this.lastDelivered !== null) {
      this.cache.delete(this.lastDelivered.fingerprint);
      this.lastDelivered = null;
    }
  }

  /**
   * Clear the in-memory completion cache.
   */
  clearCache(): void {
    this.cache.clear();
    this.lastDelivered = null;
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
