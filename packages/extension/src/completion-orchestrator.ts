/**
 * Completion Orchestrator — coordinates the entire completion pipeline:
 *
 * 1. Receive editor completion request
 * 2. Check if request should be processed
 * 3. Schedule with debounce + cancellation
 * 4. Build context from document
 * 5. Call provider to get completion
 * 6. Normalize the output
 * 7. Return clean completion items
 */

import type { ProviderConfig } from "@local-copilot/shared";
import { buildCompletionRequest, generateRequestId } from "./context-engine";
import { complete, testConnection } from "./openai-provider";
import { normalizeCompletion } from "./completion-normalizer";
import { RequestScheduler } from "./request-scheduler";

/**
 * The orchestrator's connection state.
 */
export type OrchestratorState = "idle" | "connected" | "disconnected" | "checking";

/**
 * Completion Orchestrator — manages the full completion lifecycle.
 */
export class CompletionOrchestrator {
  private scheduler: RequestScheduler;
  private config: ProviderConfig;
  private state: OrchestratorState = "idle";
  private lastLatencyMs: number | null = null;

  constructor(config: ProviderConfig) {
    this.config = config;
    this.scheduler = new RequestScheduler(config.debounceMs);
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

    // Skip if already cancelled
    if (params.cancellationToken?.isCancellationRequested) {
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

    if (signal === null) return null;

    try {
      // Wait for the debounced signal, then call the provider
      const abortSignal = await signal;

      // Check cancellation after debounce
      if (abortSignal.aborted || params.cancellationToken?.isCancellationRequested) {
        return null;
      }

      // Call the provider
      const result = await complete(request, this.config, abortSignal);

      // Mark request as completed
      this.scheduler.markCompleted(requestId);

      if (result === null) return null;

      // Track latency
      this.lastLatencyMs = result.latencyMs;

      // Normalize the output
      const normalized = normalizeCompletion(result.text, request.prefix, request.suffix);

      return normalized;
    } catch {
      this.scheduler.markCompleted(requestId);
      return null;
    }
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
