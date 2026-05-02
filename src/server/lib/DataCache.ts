class DataCache {
  private store = new Map<string, { data: unknown; ts: number }>();

  get<T>(key: string, ttlMs: number): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > ttlMs) {
      this.store.delete(key);
      return null;
    }
    return entry.data as T;
  }

  set<T>(key: string, data: T): void {
    this.store.set(key, { data, ts: Date.now() });
  }

  invalidate(instanceId: number): void {
    const prefix = `:${instanceId}:`;
    for (const key of this.store.keys()) {
      if (key.includes(prefix)) this.store.delete(key);
    }
  }

  clear(): void {
    this.store.clear();
  }
}

export const dataCache = new DataCache();
export const CACHE_TTL_MS = 5 * 60 * 1000;
