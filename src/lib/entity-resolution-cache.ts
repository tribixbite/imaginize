/**
 * Entity Resolution Cache
 * Caches LLM-based entity resolution decisions to avoid repeated API calls
 */

export interface CacheEntry {
  newElementName: string;
  newElementType: string;
  existingElementName: string;
  isMatch: boolean;
  confidence: number;
  reasoning: string;
  timestamp: number;
}

export interface CacheKey {
  newName: string;
  newType: string;
  existingName: string;
}

export class EntityResolutionCache {
  private cache: Map<string, CacheEntry>;
  private hits: number = 0;
  private misses: number = 0;
  private maxSize: number;
  private ttlMs: number;

  /**
   * @param maxSize Maximum cache entries (default: 1000)
   * @param ttlMs Time-to-live in milliseconds (default: 1 hour)
   */
  constructor(maxSize: number = 1000, ttlMs: number = 3600000) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  /**
   * Generate cache key from element names
   */
  private getCacheKey(key: CacheKey): string {
    return `${key.newType}:${key.newName.toLowerCase()}:${key.existingName.toLowerCase()}`;
  }

  /**
   * Get cached resolution decision
   */
  get(key: CacheKey): CacheEntry | null {
    const cacheKey = this.getCacheKey(key);
    const entry = this.cache.get(cacheKey);

    if (!entry) {
      this.misses++;
      return null;
    }

    // Check if entry is expired
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(cacheKey);
      this.misses++;
      return null;
    }

    this.hits++;
    return entry;
  }

  /**
   * Store resolution decision in cache
   */
  set(key: CacheKey, isMatch: boolean, confidence: number, reasoning: string): void {
    // Enforce max size by removing oldest entries
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    const cacheKey = this.getCacheKey(key);
    this.cache.set(cacheKey, {
      newElementName: key.newName,
      newElementType: key.newType,
      existingElementName: key.existingName,
      isMatch,
      confidence,
      reasoning,
      timestamp: Date.now(),
    });
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    hits: number;
    misses: number;
    hitRate: number;
  } {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
    };
  }

  /**
   * Remove expired entries (cleanup)
   */
  cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttlMs) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach((key) => this.cache.delete(key));
  }

  /**
   * Get all cached entries (for debugging/analysis)
   */
  getAll(): CacheEntry[] {
    return Array.from(this.cache.values());
  }

  /**
   * Export cache as JSON
   */
  toJSON(): string {
    return JSON.stringify(
      {
        stats: this.getStats(),
        entries: this.getAll(),
      },
      null,
      2
    );
  }

  /**
   * Import cache from JSON
   */
  fromJSON(json: string): void {
    try {
      const data = JSON.parse(json);
      if (data.entries && Array.isArray(data.entries)) {
        this.cache.clear();
        for (const entry of data.entries) {
          const key = this.getCacheKey({
            newName: entry.newElementName,
            newType: entry.newElementType,
            existingName: entry.existingElementName,
          });
          this.cache.set(key, entry);
        }
      }
    } catch (error) {
      console.error('Failed to import cache from JSON:', error);
    }
  }
}
