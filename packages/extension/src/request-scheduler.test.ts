import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RequestScheduler } from "./request-scheduler";

describe("RequestScheduler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // -----------------------------------------------------------------------
  // Basic scheduling
  // -----------------------------------------------------------------------

  describe("schedule", () => {
    it("should resolve with an AbortSignal after debounce", async () => {
      const scheduler = new RequestScheduler(100);
      const signalPromise = scheduler.schedule({
        requestId: "req-1",
        documentVersion: 1,
        line: 5,
        character: 10,
        prefix: "hello",
        suffix: "world",
        model: "test",
      });

      expect(signalPromise).not.toBeNull();

      // Advance past debounce
      vi.advanceTimersByTime(150);

      const signal = await signalPromise!;
      expect(signal).toBeInstanceOf(AbortSignal);
      expect(signal.aborted).toBe(false);

      scheduler.dispose();
    });

    it("should cancel previous request when a new one is scheduled", async () => {
      const scheduler = new RequestScheduler(100);

      // Schedule first request
      void scheduler.schedule({
        requestId: "req-1",
        documentVersion: 1,
        line: 5,
        character: 10,
        prefix: "hello",
        suffix: "world",
        model: "test",
      });

      // Schedule second request before first resolves
      const signal2Promise = scheduler.schedule({
        requestId: "req-2",
        documentVersion: 1,
        line: 5,
        character: 11,
        prefix: "hello",
        suffix: "world",
        model: "test",
      });

      // Advance past debounce
      vi.advanceTimersByTime(150);

      // First signal should have been aborted (via the old abort controller)
      // But the Promise still resolves — we check the new request is active
      const signal2 = await signal2Promise!;
      expect(signal2.aborted).toBe(false);

      scheduler.dispose();
    });
  });

  // -----------------------------------------------------------------------
  // Cancel
  // -----------------------------------------------------------------------

  describe("cancel", () => {
    it("should cancel pending debounce", async () => {
      const scheduler = new RequestScheduler(100);
      scheduler.schedule({
        requestId: "req-1",
        documentVersion: 1,
        line: 5,
        character: 10,
        prefix: "hello",
        suffix: "world",
        model: "test",
      });

      // Cancel before debounce completes
      scheduler.cancel();

      // The promise should never resolve (or resolve with aborted signal)
      // We verify by checking hasActiveRequest is false
      expect(scheduler.hasActiveRequest).toBe(false);

      scheduler.dispose();
    });
  });

  // -----------------------------------------------------------------------
  // State tracking
  // -----------------------------------------------------------------------

  describe("state", () => {
    it("should report hasActiveRequest correctly", async () => {
      const scheduler = new RequestScheduler(50);

      expect(scheduler.hasActiveRequest).toBe(false);
      expect(scheduler.currentRequestId).toBeNull();

      const signalPromise = scheduler.schedule({
        requestId: "req-1",
        documentVersion: 1,
        line: 5,
        character: 10,
        prefix: "hello",
        suffix: "world",
        model: "test",
      });

      vi.advanceTimersByTime(100);
      await signalPromise;

      // After debounce resolves, markCompleted clears it
      scheduler.markCompleted("req-1");
      expect(scheduler.hasActiveRequest).toBe(false);
      expect(scheduler.currentRequestId).toBeNull();

      scheduler.dispose();
    });

    it("should only clear the matching requestId", async () => {
      const scheduler = new RequestScheduler(50);

      const signalPromise = scheduler.schedule({
        requestId: "req-1",
        documentVersion: 1,
        line: 5,
        character: 10,
        prefix: "hello",
        suffix: "world",
        model: "test",
      });

      vi.advanceTimersByTime(100);
      await signalPromise;

      // Mark a different request as completed — should not clear current
      scheduler.markCompleted("req-2");
      expect(scheduler.hasActiveRequest).toBe(true);

      scheduler.dispose();
    });
  });

  // -----------------------------------------------------------------------
  // Dispose
  // -----------------------------------------------------------------------

  describe("dispose", () => {
    it("should cancel all pending work", () => {
      const scheduler = new RequestScheduler(100);
      scheduler.schedule({
        requestId: "req-1",
        documentVersion: 1,
        line: 5,
        character: 10,
        prefix: "hello",
        suffix: "world",
        model: "test",
      });

      scheduler.dispose();
      expect(scheduler.hasActiveRequest).toBe(false);
    });
  });
});
