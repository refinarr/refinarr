import { describe, test, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { dataCache } from "@/server/lib/data-cache";
import { GET, DELETE } from "@/app/api/diagnostics/cache/route";

const ctxNone = { params: Promise.resolve({}) };

function makeReq(method: "GET" | "DELETE") {
  return new NextRequest("http://localhost/api/diagnostics/cache", { method });
}

beforeEach(() => {
  dataCache.clear();
});

describe("GET /api/diagnostics/cache", () => {
  test("returns the CacheStatsSnapshot shape", async () => {
    const res = await GET(makeReq("GET"), ctxNone);
    expect(res.status).toBe(200);
    const body = await res.json();
    // Shape contract — the diagnostics page reads each of these.
    expect(body).toEqual(
      expect.objectContaining({
        entries: expect.any(Number),
        maxEntries: expect.any(Number),
        sizeBytes: expect.any(Number),
        maxSizeBytes: expect.any(Number),
        hits: expect.any(Number),
        misses: expect.any(Number),
        evictions: expect.any(Number),
        inflightCount: expect.any(Number),
        // oldestEntryAtMs is null on an empty cache.
        oldestEntryAtMs: null,
      }),
    );
  });

  test("reflects writes since the last clear", async () => {
    dataCache.set("k:1:data", { items: [1, 2, 3] });
    dataCache.get("k:1:data", 60_000); // hit
    dataCache.get("k:missing", 60_000); // miss
    const res = await GET(makeReq("GET"), ctxNone);
    const body = await res.json();
    expect(body.entries).toBe(1);
    expect(body.hits).toBe(1);
    expect(body.misses).toBe(1);
    expect(body.sizeBytes).toBeGreaterThan(0);
    expect(body.oldestEntryAtMs).not.toBeNull();
  });
});

describe("DELETE /api/diagnostics/cache", () => {
  test("clears the cache and returns ok", async () => {
    dataCache.set("k:1:data", { items: [1] });
    dataCache.set("k:2:data", { items: [2] });
    const res = await DELETE(makeReq("DELETE"), ctxNone);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(dataCache.getStats().entries).toBe(0);
    expect(dataCache.getStats().hits).toBe(0);
    expect(dataCache.getStats().misses).toBe(0);
  });
});
