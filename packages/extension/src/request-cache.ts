/**
 * L1 Request Cache — in-memory LRU cache with TTL for completion results.
 *
 * Stores normalized completion results keyed by request fingerprint to avoid
 * redundant provider calls for identical editor states.
 */

export interface CacheEntry<T> {
  readonly value: T;
  readonly expiresAt: number;
}

export interface RequestCacheOptions {
  /** Maximum number of entries before LRU eviction. Defaults to 100. */
  readonly maxSize?: number;
  /** Default time-to-live in milliseconds. Defaults to 5000ms (5s). */
  readonly defaultTtlMs?: number;
}

export interface CacheStats {
  readonly hits: number;
  readonly misses: number;
  readonly size: number;
  readonly maxSize: number;
}

export class RequestCache<T = string> {
  private readonly entries = new Map<string, CacheEntry<T>>();
  private readonly maxSize: number;
  private readonly defaultTtlMs: number;
  private hitCount = 0;
  private missCount = 0;

  constructor(options?: RequestCacheOptions) {
    this.maxSize = options?.maxSize ?? 100;
    this.defaultTtlMs = options?.defaultTtlMs ?? 5000;
  }

  /**
   * Get a cached value by key (fingerprint).
   * Returns null if not found or expired.
   */
  get(key: string): T | null {
    const entry = this.entries.get(key);

    if (!entry) {
      this.missCount++;
      return null;
    }

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.entries.delete(key);
      this.missCount++;
      return null;
    }

    // Refresh LRU order (delete and re-insert)
    this.entries.delete(key);
    this.entries.set(key, entry);

    this.hitCount++;
    return entry.value;
  }

  /**
   * Store a value in the cache with an optional TTL in milliseconds.
   */
  set(key: string, value: T, ttlMs?: number): void {
    const ttl = ttlMs ?? this.defaultTtlMs;
    const expiresAt = Date.now() + ttl;

    // If key already exists, delete it first to maintain insertion order
    if (this.entries.has(key)) {
      this.entries.delete(key);
    } else if (this.entries.size >= this.maxSize) {
      // Evict least recently used (first key in Map)
      const oldestKey = this.entries.keys().next().value;
      if (oldestKey !== undefined) {
        this.entries.delete(oldestKey);
      }
    }

    this.entries.set(key, { value, expiresAt });
  }

  /**
   * Check if a key exists and is not expired.
   */
  has(key: string): boolean {
    const entry = this.entries.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.entries.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Delete a specific key from the cache.
   */
  delete(key: string): boolean {
    return this.entries.delete(key);
  }

  /**
   * Clear all entries from the cache and reset statistics.
   */
  clear(): void {
    this.entries.clear();
    this.hitCount = 0;
    this.missCount = 0;
  }

  /**
   * Current number of unexpired entries in the cache.
   */
  get size(): number {
    // Clean up expired items on size check
    const now = Date.now();
    for (const [key, entry] of this.entries.entries()) {
      if (now > entry.expiresAt) {
        this.entries.delete(key);
      }
    }
    return this.entries.size;
  }

  /**
   * Get cache performance statistics.
   */
  get stats(): CacheStats {
    return {
      hits: this.hitCount,
      misses: this.missCount,
      size: this.size,
      maxSize: this.maxSize,
    };
  }
}
