import { describe, it, expect, vi, beforeEach } from "vitest";
import { RequestCache } from "./request-cache";

describe("RequestCache", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("should store and retrieve values", () => {
    const cache = new RequestCache<string>();
    cache.set("fp1", "const x = 1;");

    expect(cache.get("fp1")).toBe("const x = 1;");
    expect(cache.has("fp1")).toBe(true);
    expect(cache.stats.hits).toBe(1);
    expect(cache.stats.misses).toBe(0);
  });

  it("should return null for missing keys and track misses", () => {
    const cache = new RequestCache<string>();
    expect(cache.get("nonexistent")).toBeNull();
    expect(cache.has("nonexistent")).toBe(false);
    expect(cache.stats.hits).toBe(0);
    expect(cache.stats.misses).toBe(1);
  });

  it("should respect TTL expiration", () => {
    vi.useFakeTimers();
    const cache = new RequestCache<string>({ defaultTtlMs: 1000 });

    cache.set("fp1", "const y = 2;");
    expect(cache.get("fp1")).toBe("const y = 2;");

    // Advance past TTL
    vi.advanceTimersByTime(1001);

    expect(cache.get("fp1")).toBeNull();
    expect(cache.has("fp1")).toBe(false);
    expect(cache.size).toBe(0);
  });

  it("should allow custom TTL per entry", () => {
    vi.useFakeTimers();
    const cache = new RequestCache<string>({ defaultTtlMs: 5000 });

    cache.set("short", "short lived", 500);
    cache.set("long", "long lived", 2000);

    vi.advanceTimersByTime(600);
    expect(cache.get("short")).toBeNull();
    expect(cache.get("long")).toBe("long lived");

    vi.advanceTimersByTime(1500);
    expect(cache.get("long")).toBeNull();
  });

  it("should evict least recently used items when exceeding maxSize", () => {
    const cache = new RequestCache<string>({ maxSize: 3 });

    cache.set("k1", "v1");
    cache.set("k2", "v2");
    cache.set("k3", "v3");
    expect(cache.size).toBe(3);

    // Adding 4th should evict k1 (oldest)
    cache.set("k4", "v4");
    expect(cache.get("k1")).toBeNull();
    expect(cache.get("k2")).toBe("v2");
    expect(cache.get("k3")).toBe("v3");
    expect(cache.get("k4")).toBe("v4");
  });

  it("should update LRU order on get", () => {
    const cache = new RequestCache<string>({ maxSize: 3 });

    cache.set("k1", "v1");
    cache.set("k2", "v2");
    cache.set("k3", "v3");

    // Access k1 so it becomes most recently used
    expect(cache.get("k1")).toBe("v1");

    // Adding k4 should now evict k2 (the oldest unaccessed)
    cache.set("k4", "v4");
    expect(cache.get("k1")).toBe("v1");
    expect(cache.get("k2")).toBeNull();
    expect(cache.get("k3")).toBe("v3");
    expect(cache.get("k4")).toBe("v4");
  });

  it("should overwrite existing key without exceeding size limit", () => {
    const cache = new RequestCache<string>({ maxSize: 2 });

    cache.set("k1", "v1");
    cache.set("k2", "v2");
    cache.set("k1", "v1_updated");

    expect(cache.size).toBe(2);
    expect(cache.get("k1")).toBe("v1_updated");
    expect(cache.get("k2")).toBe("v2");
  });

  it("should delete specific keys", () => {
    const cache = new RequestCache<string>();
    cache.set("k1", "v1");
    expect(cache.delete("k1")).toBe(true);
    expect(cache.get("k1")).toBeNull();
    expect(cache.delete("k1")).toBe(false);
  });

  it("should clear all entries and reset stats", () => {
    const cache = new RequestCache<string>();
    cache.set("k1", "v1");
    cache.set("k2", "v2");
    cache.get("k1"); // 1 hit
    cache.get("k3"); // 1 miss

    expect(cache.size).toBe(2);
    expect(cache.stats.hits).toBe(1);
    expect(cache.stats.misses).toBe(1);

    cache.clear();

    expect(cache.size).toBe(0);
    expect(cache.stats.hits).toBe(0);
    expect(cache.stats.misses).toBe(0);
  });
});
