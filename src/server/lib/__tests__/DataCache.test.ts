import { describe, test, expect, beforeEach, vi, afterEach } from "vitest";
import { dataCache } from "@/server/lib/DataCache";

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
    expect(dataCache.getWithStaleness("missing", 1000, 5000)).toEqual({ kind: "miss" });
  });

  test("returns fresh while age <= freshMs", () => {
    vi.useFakeTimers();
    dataCache.set("k", "v");
    vi.advanceTimersByTime(900);
    expect(dataCache.getWithStaleness("k", 1000, 5000)).toEqual({ kind: "fresh", value: "v" });
  });

  test("returns stale once age exceeds freshMs but is within freshMs+staleMs", () => {
    vi.useFakeTimers();
    dataCache.set("k", "v");
    vi.advanceTimersByTime(2000);
    expect(dataCache.getWithStaleness("k", 1000, 5000)).toEqual({ kind: "stale", value: "v" });
  });

  test("evicts and returns miss past the stale window", () => {
    vi.useFakeTimers();
    dataCache.set("k", "v");
    vi.advanceTimersByTime(7000);
    expect(dataCache.getWithStaleness("k", 1000, 5000)).toEqual({ kind: "miss" });
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
    const promise = dataCache.rebuild("ib", () =>
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
    await expect(dataCache.rebuild("err", async () => "ok")).resolves.toBe("ok");
  });
});
