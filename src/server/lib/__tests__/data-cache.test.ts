import { describe, test, expect, beforeEach, vi, afterEach } from "vitest";
import { dataCache } from "@/server/lib/data-cache";

beforeEach(() => {
  dataCache.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("DataCache.get / set", () => {
  test("returns null for unknown key", () => {
    expect(dataCache.get("missing", 60_000)).toBeNull();
  });

  test("returns stored value within TTL", () => {
    dataCache.set("key:1:data", [1, 2, 3]);
    expect(dataCache.get("key:1:data", 60_000)).toEqual([1, 2, 3]);
  });

  test("returns null and removes entry after TTL expires", () => {
    vi.useFakeTimers();
    dataCache.set("ttl-key", "value");
    vi.advanceTimersByTime(61_000);
    expect(dataCache.get("ttl-key", 60_000)).toBeNull();
  });

  test("entry within TTL is returned even near boundary", () => {
    vi.useFakeTimers();
    dataCache.set("boundary-key", "value");
    vi.advanceTimersByTime(59_999);
    expect(dataCache.get("boundary-key", 60_000)).toBe("value");
  });

  test("overwriting a key replaces the value", () => {
    dataCache.set("k", "first");
    dataCache.set("k", "second");
    expect(dataCache.get("k", 60_000)).toBe("second");
  });
});

describe("DataCache.invalidate", () => {
  test("removes all keys matching the instanceId prefix", () => {
    dataCache.set("movies:1:data", ["movie1"]);
    dataCache.set("series:1:data", ["series1"]);
    dataCache.set("movies:2:data", ["movie2"]);
    dataCache.invalidate(1);
    expect(dataCache.get("movies:1:data", 60_000)).toBeNull();
    expect(dataCache.get("series:1:data", 60_000)).toBeNull();
    expect(dataCache.get("movies:2:data", 60_000)).toEqual(["movie2"]);
  });

  test("invalidating a non-existent instanceId does not throw", () => {
    expect(() => dataCache.invalidate(999)).not.toThrow();
  });
});

describe("DataCache.clear", () => {
  test("removes all entries", () => {
    dataCache.set("a:1:x", "A");
    dataCache.set("b:2:y", "B");
    dataCache.clear();
    expect(dataCache.get("a:1:x", 60_000)).toBeNull();
    expect(dataCache.get("b:2:y", 60_000)).toBeNull();
  });
});

describe("DataCache.getWithStaleness", () => {
  test("returns miss for unknown key", () => {
    expect(dataCache.getWithStaleness("missing", 1000, 5000)).toEqual({
      kind: "miss",
    });
  });

  test("returns fresh while age <= freshMs", () => {
    vi.useFakeTimers();
    dataCache.set("k", "v");
    vi.advanceTimersByTime(900);
    expect(dataCache.getWithStaleness("k", 1000, 5000)).toEqual({
      kind: "fresh",
      value: "v",
    });
  });

  test("returns stale once age exceeds freshMs but is within freshMs+staleMs", () => {
    vi.useFakeTimers();
    dataCache.set("k", "v");
    vi.advanceTimersByTime(2000);
    expect(dataCache.getWithStaleness("k", 1000, 5000)).toEqual({
      kind: "stale",
      value: "v",
    });
  });

  test("evicts and returns miss past the stale window", () => {
    vi.useFakeTimers();
    dataCache.set("k", "v");
    vi.advanceTimersByTime(7000);
    expect(dataCache.getWithStaleness("k", 1000, 5000)).toEqual({
      kind: "miss",
    });
    // Subsequent get returns null too — entry was evicted.
    expect(dataCache.get("k", 60_000)).toBeNull();
  });
});

describe("DataCache.rebuild", () => {
  test("runs the builder and caches the result", async () => {
    const value = await dataCache.rebuild("k", async () => 42);
    expect(value).toBe(42);
    expect(dataCache.get("k", 60_000)).toBe(42);
  });

  test("concurrent callers share one in-flight rebuild", async () => {
    let calls = 0;
    const slowBuild = async () => {
      calls += 1;
      await new Promise((r) => setTimeout(r, 5));
      return calls;
    };
    const [a, b, c] = await Promise.all([
      dataCache.rebuild("shared", slowBuild),
      dataCache.rebuild("shared", slowBuild),
      dataCache.rebuild("shared", slowBuild),
    ]);
    expect(calls).toBe(1);
    expect(a).toBe(1);
    expect(b).toBe(1);
    expect(c).toBe(1);
  });

  test("isRebuilding reports true during the build, false after", async () => {
    let resolveBuild: ((v: string) => void) | undefined;
    const promise = dataCache.rebuild(
      "ib",
      () =>
        new Promise<string>((res) => {
          resolveBuild = res;
        }),
    );
    expect(dataCache.isRebuilding("ib")).toBe(true);
    resolveBuild!("done");
    await promise;
    expect(dataCache.isRebuilding("ib")).toBe(false);
  });

  test("frees the slot when the builder rejects so retries can run", async () => {
    await expect(
      dataCache.rebuild("err", async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(dataCache.isRebuilding("err")).toBe(false);
    // Next attempt with a working builder succeeds.
    await expect(dataCache.rebuild("err", async () => "ok")).resolves.toBe(
      "ok",
    );
  });

  test("does not cache an in-flight rebuild after invalidate", async () => {
    const key = "movies:1:manual";
    let resolveBuild: ((v: string) => void) | undefined;
    const promise = dataCache.rebuild(
      key,
      () =>
        new Promise<string>((res) => {
          resolveBuild = res;
        }),
    );

    expect(dataCache.isRebuilding(key)).toBe(true);
    dataCache.invalidate(1);
    resolveBuild!("old");

    await expect(promise).resolves.toBe("old");
    expect(dataCache.isRebuilding(key)).toBe(false);
    expect(dataCache.get(key, 60_000)).toBeNull();
    await expect(dataCache.rebuild(key, async () => "fresh")).resolves.toBe(
      "fresh",
    );
    expect(dataCache.get(key, 60_000)).toBe("fresh");
  });

  test("does not let an invalidated rebuild clear a newer rebuild", async () => {
    let resolveOld: ((v: string) => void) | undefined;
    const old = dataCache.rebuild(
      "movies:1:manual",
      () =>
        new Promise<string>((res) => {
          resolveOld = res;
        }),
    );

    dataCache.invalidate(1);

    let resolveFresh: ((v: string) => void) | undefined;
    const fresh = dataCache.rebuild(
      "movies:1:manual",
      () =>
        new Promise<string>((res) => {
          resolveFresh = res;
        }),
    );

    resolveOld!("old");
    await old;
    expect(dataCache.isRebuilding("movies:1:manual")).toBe(true);

    resolveFresh!("fresh");
    await expect(fresh).resolves.toBe("fresh");
    expect(dataCache.get("movies:1:manual", 60_000)).toBe("fresh");
  });

  test("does not cache an in-flight rebuild after clear", async () => {
    let resolveBuild: ((v: string) => void) | undefined;
    const promise = dataCache.rebuild(
      "movies:1:manual",
      () =>
        new Promise<string>((res) => {
          resolveBuild = res;
        }),
    );

    dataCache.clear();
    resolveBuild!("old");

    await expect(promise).resolves.toBe("old");
    expect(dataCache.get("movies:1:manual", 60_000)).toBeNull();
  });
});

// LRU + stats surface (nas-perf #2 + #3). Pin the cap behaviour and
// the diagnostic counters that drive /settings/diagnostics. The
// existing `beforeEach(dataCache.clear)` resets state and counters
// between tests.
describe("DataCache — LRU eviction + getStats", () => {
  test("getStats reports zeros on a freshly-cleared cache", () => {
    const stats = dataCache.getStats();
    expect(stats.entries).toBe(0);
    expect(stats.sizeBytes).toBe(0);
    expect(stats.hits).toBe(0);
    expect(stats.misses).toBe(0);
    expect(stats.evictions).toBe(0);
    expect(stats.inflightCount).toBe(0);
    expect(stats.oldestEntryAtMs).toBeNull();
    expect(stats.maxEntries).toBeGreaterThan(0);
    expect(stats.maxSizeBytes).toBeGreaterThan(0);
    // clear() stamps lastInvalidatedAtMs as a side-effect; it's set,
    // not null, on the second beforeEach onwards. Allow either since
    // the run order isn't guaranteed.
  });

  test("get/getWithStaleness bump hits and misses", () => {
    expect(dataCache.get("movies:1:manual", 60_000)).toBeNull();
    dataCache.set("movies:1:manual", { items: ["a"] });
    expect(dataCache.get("movies:1:manual", 60_000)).toEqual({ items: ["a"] });
    dataCache.getWithStaleness("movies:1:manual", 60_000, 60_000); // hit
    dataCache.getWithStaleness("movies:2:manual", 60_000, 60_000); // miss
    const stats = dataCache.getStats();
    expect(stats.hits).toBe(2);
    expect(stats.misses).toBe(2);
  });

  test("set increases sizeBytes and oldestEntryAtMs becomes non-null", () => {
    dataCache.set("movies:1:manual", { items: [1, 2, 3] });
    const stats = dataCache.getStats();
    expect(stats.entries).toBe(1);
    expect(stats.sizeBytes).toBeGreaterThan(0);
    expect(stats.oldestEntryAtMs).not.toBeNull();
    expect(stats.oldestEntryAtMs!).toBeGreaterThanOrEqual(0);
  });

  test("invalidate stamps lastInvalidatedAtMs", () => {
    dataCache.set("movies:1:manual", { items: [] });
    const before = Date.now();
    dataCache.invalidate(1);
    const stats = dataCache.getStats();
    expect(stats.lastInvalidatedAtMs).not.toBeNull();
    expect(stats.lastInvalidatedAtMs!).toBeGreaterThanOrEqual(before);
  });

  // Pushing past the LRU cap (200) — verifies the cache stays bounded
  // AND the evictions counter (driven by disposeAfter with
  // `reason === "evict"`) increments. Picks unique keys so prior
  // tests' state can't leak in.
  test("evicts oldest entries when the entry-count cap is exceeded", () => {
    const stats0 = dataCache.getStats();
    const cap = stats0.maxEntries;
    for (let i = 0; i < cap + 5; i += 1) {
      dataCache.set(`evict-test:${i}:data`, { items: [i] });
    }
    const after = dataCache.getStats();
    expect(after.entries).toBeLessThanOrEqual(cap);
    expect(after.evictions).toBeGreaterThanOrEqual(5);
  });

  // The first ~5 inserted keys should now be gone; the most recent
  // ones still present. Pinning the FIFO-by-LRU property prevents a
  // future "swap LRU for something else" from silently changing
  // eviction order.
  test("LRU order is preserved — oldest entries evict first", () => {
    const stats0 = dataCache.getStats();
    const cap = stats0.maxEntries;
    for (let i = 0; i < cap + 3; i += 1) {
      dataCache.set(`order-test:${i}:data`, { items: [i] });
    }
    // First 3 evicted; last 3 still present.
    expect(dataCache.get("order-test:0:data", 60_000)).toBeNull();
    expect(dataCache.get("order-test:2:data", 60_000)).toBeNull();
    expect(dataCache.get(`order-test:${cap + 2}:data`, 60_000)).toEqual({
      items: [cap + 2],
    });
  });

  // sizeCalculation must not throw — JSON.stringify rejects circular
  // refs (TypeError) and returns undefined on `undefined` data. Both
  // cases used to crash the cache write path; the estimateBytes guard
  // pins them to a flat fallback so the entry still consumes some
  // budget toward the LRU cap.
  test("set tolerates circular references without throwing", () => {
    const a: Record<string, unknown> = { name: "a" };
    a.self = a;
    expect(() => dataCache.set("circular", a)).not.toThrow();
    expect(dataCache.get("circular", 60_000)).toBe(a);
    expect(dataCache.getStats().sizeBytes).toBeGreaterThan(0);
  });

  test("set tolerates undefined data without throwing", () => {
    expect(() => dataCache.set("undef", undefined)).not.toThrow();
    // Get returns the stored value (undefined), but the cache row exists.
    expect(dataCache.getStats().entries).toBe(1);
  });
});
