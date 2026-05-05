// Three-state cache result for stale-while-revalidate. Callers branch on
// `kind` to decide whether to serve cached data, kick off a background
// refresh, or block on a fresh build.
type CacheResult<T> =
  | { kind: "fresh"; value: T }
  | { kind: "stale"; value: T }
  | { kind: "miss" };

class DataCache {
  private store = new Map<string, { data: unknown; ts: number }>();
  // Tracks in-flight rebuilds per key so concurrent stale/miss reads don't
  // each fire their own upstream refresh. The first caller starts the
  // promise; subsequent callers either get the stale value (SWR) or await
  // the same promise (cold).
  private inflight = new Map<string, Promise<unknown>>();

  get<T>(key: string, ttlMs: number): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > ttlMs) {
      this.store.delete(key);
      return null;
    }
    return entry.data as T;
  }

  // SWR read. `freshMs` is how long the value is considered current;
  // `staleMs` is the additional window during which the cached value is
  // returned immediately while a background refresh runs. Past `staleMs`
  // the entry is evicted and the next caller blocks on a rebuild.
  getWithStaleness<T>(
    key: string,
    freshMs: number,
    staleMs: number,
  ): CacheResult<T> {
    const entry = this.store.get(key);
    if (!entry) return { kind: "miss" };
    const age = Date.now() - entry.ts;
    if (age <= freshMs) return { kind: "fresh", value: entry.data as T };
    if (age <= freshMs + staleMs)
      return { kind: "stale", value: entry.data as T };
    this.store.delete(key);
    return { kind: "miss" };
  }

  set<T>(key: string, data: T): void {
    this.store.set(key, { data, ts: Date.now() });
  }

  // Returns true if a rebuild for `key` is already running. Used by SWR
  // callers to skip kicking off a duplicate refresh.
  isRebuilding(key: string): boolean {
    return this.inflight.has(key);
  }

  // Wraps an async builder so concurrent callers share one rebuild. The
  // result is cached on success; the in-flight slot is freed in either
  // case so a transient upstream failure doesn't block subsequent
  // attempts.
  async rebuild<T>(key: string, build: () => Promise<T>): Promise<T> {
    const existing = this.inflight.get(key) as Promise<T> | undefined;
    if (existing) return existing;
    const promise = build()
      .then((value) => {
        this.set(key, value);
        return value;
      })
      .finally(() => {
        this.inflight.delete(key);
      });
    this.inflight.set(key, promise);
    return promise;
  }

  invalidate(instanceId: number): void {
    const prefix = `:${instanceId}:`;
    for (const key of this.store.keys()) {
      if (key.includes(prefix)) this.store.delete(key);
    }
  }

  clear(): void {
    this.store.clear();
    this.inflight.clear();
  }
}

export const dataCache = new DataCache();
export const CACHE_TTL_MS = 5 * 60 * 1000;
// Stale window: cached data continues to serve for this long past freshTtl
// while a background refresh runs. 30 minutes is forgiving — even a slow
// upstream rebuild has time to complete before the entry hard-expires.
export const CACHE_STALE_MS = 30 * 60 * 1000;
