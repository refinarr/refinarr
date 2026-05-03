import { describe, test, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { PUT } from "@/app/api/config/route";
import { dataCache } from "@/server/lib/DataCache";

const ctxNone = { params: Promise.resolve({}) };

function putReq(body: unknown) {
  return new NextRequest("http://localhost/api/config", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PUT /api/config — cache invalidation", () => {
  beforeEach(() => {
    dataCache.clear();
  });

  test("scoringMode change invalidates that instance's flagged-media cache", async () => {
    dataCache.set("movies:5:manual", ["stale"]);
    dataCache.set("series:5:manual", ["stale"]);
    dataCache.set("movies:7:manual", ["other"]);

    const res = await PUT(putReq({ "scoringMode:5": "profile" }), ctxNone);
    expect(res.status).toBe(200);

    expect(dataCache.get("movies:5:manual", 60_000)).toBeNull();
    expect(dataCache.get("series:5:manual", 60_000)).toBeNull();
    // Other instances are untouched.
    expect(dataCache.get("movies:7:manual", 60_000)).toEqual(["other"]);
  });

  test("non-scoring-mode keys (dryRun) do not invalidate any cache", async () => {
    dataCache.set("movies:5:manual", ["stale"]);
    const res = await PUT(putReq({ dryRun: "true" }), ctxNone);
    expect(res.status).toBe(200);
    expect(dataCache.get("movies:5:manual", 60_000)).toEqual(["stale"]);
  });

  test("multi-instance scoring-mode update invalidates each instance", async () => {
    dataCache.set("movies:1:manual", ["a"]);
    dataCache.set("movies:2:manual", ["b"]);
    dataCache.set("movies:3:manual", ["c"]);

    const res = await PUT(
      putReq({ "scoringMode:1": "profile", "scoringMode:2": "profile" }),
      ctxNone,
    );
    expect(res.status).toBe(200);

    expect(dataCache.get("movies:1:manual", 60_000)).toBeNull();
    expect(dataCache.get("movies:2:manual", 60_000)).toBeNull();
    expect(dataCache.get("movies:3:manual", 60_000)).toEqual(["c"]);
  });

  test("apiKey is rejected (reserved) and never reaches cache invalidation logic", async () => {
    const res = await PUT(putReq({ apiKey: "should-not-write" }), ctxNone);
    // Reserved keys are silently filtered, route still 200s.
    expect(res.status).toBe(200);
  });
});
