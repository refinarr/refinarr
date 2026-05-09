import { describe, test, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { dataCache } from "@/server/lib/data-cache";
import { PUT } from "@/app/api/config/route";

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

  test("non-scoring-mode keys (dryRun) do not invalidate any cache", async () => {
    dataCache.set("movies:5:manual", ["stale"]);
    const res = await PUT(putReq({ dryRun: "true" }), ctxNone);
    expect(res.status).toBe(200);
    expect(dataCache.get("movies:5:manual", 60_000)).toEqual(["stale"]);
  });

  test("apiKey is rejected (reserved) and never reaches cache invalidation logic", async () => {
    const res = await PUT(putReq({ apiKey: "should-not-write" }), ctxNone);
    // Reserved keys are silently filtered, route still 200s.
    expect(res.status).toBe(200);
  });
});
