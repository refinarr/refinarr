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
