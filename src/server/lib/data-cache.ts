import { LRUCache } from "lru-cache";
import type { CacheStatsSnapshot } from "@/shared/types/api";

// Three-state cache result for stale-while-revalidate. Callers branch on
// `kind` to decide whether to serve cached data, kick off a background
// refresh, or block on a fresh build.
type CacheResult<T> =
  | { kind: "fresh"; value: T }
  | { kind: "stale"; value: T }
  | { kind: "miss" };

interface StoreEntry {
  data: unknown;
  ts: number;
}

// Hard ceilings for steady-state memory. Sized for the real-world
// worst case observed in profile mode: ~25 MB per heavy Sonarr cache
// (113 series × 6,853 episode files with rich CF arrays per file).
// 100 MB fits ~4 such instances comfortably — covers a typical 2
// Sonarr + 2 Radarr setup without LRU thrashing. Bump higher if you
// run 5+ instances and have RAM headroom; lower it on memory-tight
// NAS deployments (eviction is graceful — older entries refetch on
// next access).
const MAX_ENTRIES = 200;
const MAX_SIZE_BYTES = 100 * 1024 * 1024;

// Fallback size when JSON.stringify can't measure the entry (circular
// reference throws; undefined / a function returns undefined). 1 KB is
// large enough to count toward the cap so circular-ref entries can't
// silently hide from eviction, small enough to be inert in normal use.
const FALLBACK_ENTRY_BYTES = 1024;

function estimateBytes(data: unknown): number {
  try {
    const json = JSON.stringify(data);
    // `undefined` (or a function) serializes to `undefined`, not a
    // string. Treat as the fallback so the entry still consumes some
    // budget toward the LRU cap.
    if (typeof json !== "string") return FALLBACK_ENTRY_BYTES;
    return Math.max(1, json.length * 2);
  } catch {
    // Circular references throw TypeError; fall back to a flat estimate
    // rather than blowing up the cache write path.
    return FALLBACK_ENTRY_BYTES;
  }
}

class DataCache {
  // LRU swap: was `new Map<string, StoreEntry>()` — same synchronous
  // get/set/has/delete/keys API, plus eviction by count AND byte size.
  // sizeCalculation runs once on insert; cheap because writes invalidate
  // first (the entry that bypasses sizeCalculation is the stale entry
  // we just dropped, not the new fresh one).
  private store: LRUCache<string, StoreEntry>;
  // Tracks in-flight rebuilds per key so concurrent stale/miss reads don't
  // each fire their own upstream refresh. The first caller starts the
  // promise; subsequent callers either get the stale value (SWR) or await
  // the same promise (cold). Stays a plain Map — promises don't get a
  // size cap, and counts max out at ~one-per-active-key.
  private inflight = new Map<string, Promise<unknown>>();
  private versions = new Map<string, number>();
  private generation = 0;

  // Diagnostic counters surfaced via getStats() for /api/diagnostics/cache.
  // No behaviour change — just observation.
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    lastInvalidatedAtMs: null as number | null,
  };

  constructor() {
    this.store = new LRUCache<string, StoreEntry>({
      max: MAX_ENTRIES,
      maxSize: MAX_SIZE_BYTES,
      sizeCalculation: (entry) => estimateBytes(entry.data),
      // `disposeAfter` fires for ANY removal — including explicit
      // delete()/clear()/set(replace). Filter on `reason === "evict"`
      // so the counter only reflects true LRU/size overflow, not
      // intentional invalidations.
      disposeAfter: (_value, _key, reason) => {
        if (reason === "evict") this.stats.evictions += 1;
      },
    });
  }

  get<T>(key: string, ttlMs: number): T | null {
    const entry = this.store.get(key);
    if (!entry) {
      this.stats.misses += 1;
      return null;
    }
    if (Date.now() - entry.ts > ttlMs) {
      this.store.delete(key);
      this.stats.misses += 1;
      return null;
    }
    this.stats.hits += 1;
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
    if (!entry) {
      this.stats.misses += 1;
      return { kind: "miss" };
    }
    const age = Date.now() - entry.ts;
    if (age <= freshMs) {
      this.stats.hits += 1;
      return { kind: "fresh", value: entry.data as T };
    }
    if (age <= freshMs + staleMs) {
      this.stats.hits += 1;
      return { kind: "stale", value: entry.data as T };
    }
    this.store.delete(key);
    this.stats.misses += 1;
    return { kind: "miss" };
  }

  set<T>(key: string, data: T): void {
    this.store.set(key, { data, ts: Date.now() });
  }

  private bumpVersion(key: string): void {
    this.versions.set(key, (this.versions.get(key) ?? 0) + 1);
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
    const generation = this.generation;
    const version = this.versions.get(key) ?? 0;
    const promise = build()
      .then((value) => {
        if (
          generation === this.generation &&
          version === (this.versions.get(key) ?? 0)
        ) {
          this.set(key, value);
        }
        return value;
      })
      .finally(() => {
        if (this.inflight.get(key) === promise) {
          this.inflight.delete(key);
        }
      });
    this.inflight.set(key, promise);
    return promise;
  }

  invalidate(instanceId: number): void {
    const prefix = `:${instanceId}:`;
    const keys = new Set([...this.store.keys(), ...this.inflight.keys()]);
    for (const key of keys) {
      if (!key.includes(prefix)) continue;
      this.store.delete(key);
      this.inflight.delete(key);
      this.bumpVersion(key);
    }
    this.stats.lastInvalidatedAtMs = Date.now();
  }

  clear(): void {
    this.generation += 1;
    this.store.clear();
    this.inflight.clear();
    this.versions.clear();
    // Reset counters too — `clear()` is the "blow it all away" hook
    // surfaced by the /settings/diagnostics "Clear cache" button, and a
    // user expects hit/miss/eviction tallies to start fresh after they
    // press it. `invalidate()` is the targeted equivalent that keeps
    // counters running.
    this.stats.hits = 0;
    this.stats.misses = 0;
    this.stats.evictions = 0;
    this.stats.lastInvalidatedAtMs = Date.now();
  }

  getStats(): CacheStatsSnapshot {
    // Iterate once to find the oldest insert timestamp; capped at
    // MAX_ENTRIES (200) so this is sub-millisecond even at full cap.
    // Returned as an absolute epoch ms so the client can pass it to
    // formatRelative() without doing Date.now() arithmetic in render.
    let oldestTs: number | null = null;
    for (const entry of this.store.values()) {
      if (oldestTs === null || entry.ts < oldestTs) oldestTs = entry.ts;
    }
    return {
      entries: this.store.size,
      maxEntries: MAX_ENTRIES,
      sizeBytes: this.store.calculatedSize,
      maxSizeBytes: MAX_SIZE_BYTES,
      hits: this.stats.hits,
      misses: this.stats.misses,
      evictions: this.stats.evictions,
      inflightCount: this.inflight.size,
      oldestEntryAtMs: oldestTs,
      lastInvalidatedAtMs: this.stats.lastInvalidatedAtMs,
    };
  }
}

export const dataCache = new DataCache();
export const CACHE_TTL_MS = 5 * 60 * 1000;
// Stale window: cached data continues to serve for this long past freshTtl
// while a background refresh runs. 12 hours is generous — once a cache
// has been built once for an instance, it's effectively pinned for the
// session. The user will rarely hit a hard miss (and pay the upstream
// rebuild latency) outside of fresh server startup or explicit invalidate.
export const CACHE_STALE_MS = 12 * 60 * 60 * 1000;
