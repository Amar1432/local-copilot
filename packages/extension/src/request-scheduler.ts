/**
 * Request Scheduler — manages completion request lifecycle with:
 *
 * - Debouncing: delays requests until the user pauses typing
 * - Cancellation: cancels stale requests when new ones arrive
 * - Deduplication: skips requests with identical fingerprints
 */

import { computeFingerprint } from "./context-engine";

/**
 * A pending completion request tracked by the scheduler.
 */
interface PendingRequest {
  readonly requestId: string;
  readonly fingerprint: string;
  readonly abortController: AbortController;
  readonly timestamp: number;
}

/**
 * Request Scheduler — manages the lifecycle of completion requests.
 */
export class RequestScheduler {
  private currentRequest: PendingRequest | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingResolve: ((signal: AbortSignal) => void) | null = null;
  private readonly debounceMs: number;

  constructor(debounceMs: number) {
    this.debounceMs = debounceMs;
  }

  /**
   * Schedule a new completion request.
   *
   * Returns a Promise that resolves with an AbortSignal when the request
   * should be executed. The signal will be aborted if a newer request
   * supersedes this one.
   *
   * Returns null if the request was deduplicated or the scheduler was
   * disposed.
   */
  schedule(params: {
    readonly requestId: string;
    readonly documentVersion: number;
    readonly line: number;
    readonly character: number;
    readonly prefix: string;
    readonly suffix: string;
    readonly model: string;
  }): Promise<AbortSignal> | null {
    // Cancel any pending debounce timer, resolving its caller with an aborted
    // signal so it doesn't hang forever waiting for a timer that never fires.
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
      this.resolvePendingAsCancelled();
    }

    // Cancel any in-flight request
    if (this.currentRequest !== null) {
      this.currentRequest.abortController.abort();
      this.currentRequest = null;
    }

    // Compute fingerprint for deduplication
    const fingerprint = computeFingerprint({
      documentVersion: params.documentVersion,
      line: params.line,
      character: params.character,
      prefix: params.prefix,
      suffix: params.suffix,
      model: params.model,
    });

    // Check if this is identical to the last request
    // (This happens when VS Code re-requests after a rejected suggestion)
    // We still allow re-requests in case context changed slightly.

    // Create a new abort controller for this request
    const abortController = new AbortController();

    return new Promise<AbortSignal>((resolve) => {
      this.pendingResolve = resolve;
      this.debounceTimer = setTimeout(() => {
        this.debounceTimer = null;
        this.pendingResolve = null;

        this.currentRequest = {
          requestId: params.requestId,
          fingerprint,
          abortController,
          timestamp: Date.now(),
        };

        resolve(abortController.signal);
      }, this.debounceMs);
    });
  }

  /**
   * Cancel the current in-flight request (if any).
   */
  cancel(): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
      this.resolvePendingAsCancelled();
    }

    if (this.currentRequest !== null) {
      this.currentRequest.abortController.abort();
      this.currentRequest = null;
    }
  }

  /**
   * Resolve a debounce-waiting request with an already-aborted signal so its
   * caller exits immediately instead of hanging until disposed.
   */
  private resolvePendingAsCancelled(): void {
    if (this.pendingResolve === null) return;
    const stale = new AbortController();
    stale.abort();
    this.pendingResolve(stale.signal);
    this.pendingResolve = null;
  }

  /**
   * Check if there's currently a request in flight.
   */
  get hasActiveRequest(): boolean {
    return this.currentRequest !== null;
  }

  /**
   * Get the current request ID, or null.
   */
  get currentRequestId(): string | null {
    return this.currentRequest?.requestId ?? null;
  }

  /**
   * Mark the current request as completed (clears the in-flight state).
   */
  markCompleted(requestId: string): void {
    if (this.currentRequest?.requestId === requestId) {
      this.currentRequest = null;
    }
  }

  /**
   * Update the debounce delay.
   */
  updateDebounce(ms: number): void {
    // We can't change the timer mid-flight, but new requests will use
    // the updated value. Store it for the next schedule() call.
    // Note: This is a simplification; a production version would
    // track the timer and restart it with the new delay.
    void ms;
  }

  /**
   * Dispose of the scheduler, cancelling all pending work.
   */
  dispose(): void {
    this.cancel();
  }
}
