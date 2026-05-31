import { describe, test, expect, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { dataCache } from "@/server/lib/data-cache";
import { statusPoller } from "@/server/lib/status-poller";
import { POST as createInstance } from "@/app/api/instances/route";
import { POST as testConnection } from "@/app/api/instances/[id]/test/route";
import { POST as refresh } from "@/app/api/instances/[id]/refresh/route";
import { mswServer, radarrHandlers } from "@/test/msw";

const baseUrl = "http://192.168.1.10:7878";
const valid = {
  type: "radarr" as const,
  name: "MSW Radarr",
  url: baseUrl,
  apiKey: "abcd1234abcd1234abcd1234abcd1234",
};
const ctxFor = (id: number) => ({
  params: Promise.resolve({ id: String(id) }),
});

async function makeInstance(): Promise<number> {
  const res = await createInstance(
    new NextRequest("http://localhost/api/instances", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(valid),
    }),
    { params: Promise.resolve({}) },
  );
  const body = await res.json();
  return body.id as number;
}

describe("POST /api/instances/[id]/test", () => {
  test("ok: true when upstream returns 200", async () => {
    const id = await makeInstance();
    mswServer.use(
      ...radarrHandlers({ baseUrl }, { systemStatus: { status: 200 } }),
    );
    const res = await testConnection(
      new NextRequest(`http://localhost/api/instances/${id}/test`, {
        method: "POST",
      }),
      ctxFor(id),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  test("ok: false when upstream returns 403", async () => {
    const id = await makeInstance();
    mswServer.use(
      ...radarrHandlers({ baseUrl }, { systemStatus: { status: 403 } }),
    );
    const res = await testConnection(
      new NextRequest(`http://localhost/api/instances/${id}/test`, {
        method: "POST",
      }),
      ctxFor(id),
    );
    expect(await res.json()).toEqual({ ok: false });
  });

  test("404 when instance does not exist (#22)", async () => {
    const res = await testConnection(
      new NextRequest("http://localhost/api/instances/99999/test", {
        method: "POST",
      }),
      ctxFor(99999),
    );
    expect(res.status).toBe(404);
  });

  // The Test button is the user's "I just fixed something — pick it
  // up now" escape hatch from the back-off / dedupe machinery. On a
  // successful test we trigger statusPoller.refresh so the next tick
  // fires immediately rather than waiting up to MAX_BACKOFF_MS. On
  // failure we skip the refresh: re-arming the same broken cadence
  // wastes upstream calls.
  describe("statusPoller integration", () => {
    afterEach(() => vi.restoreAllMocks());

    test("triggers statusPoller.refresh on a successful test", async () => {
      const id = await makeInstance();
      mswServer.use(
        ...radarrHandlers({ baseUrl }, { systemStatus: { status: 200 } }),
      );
      const spy = vi
        .spyOn(statusPoller, "refresh")
        .mockResolvedValue(undefined);

      await testConnection(
        new NextRequest(`http://localhost/api/instances/${id}/test`, {
          method: "POST",
        }),
        ctxFor(id),
      );

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(id);
    });

    test("skips statusPoller.refresh on a failed test", async () => {
      const id = await makeInstance();
      mswServer.use(
        ...radarrHandlers({ baseUrl }, { systemStatus: { status: 403 } }),
      );
      const spy = vi
        .spyOn(statusPoller, "refresh")
        .mockResolvedValue(undefined);

      await testConnection(
        new NextRequest(`http://localhost/api/instances/${id}/test`, {
          method: "POST",
        }),
        ctxFor(id),
      );

      expect(spy).not.toHaveBeenCalled();
    });
  });
});

describe("POST /api/instances/[id]/refresh", () => {
  test("clears cache entries scoped to the instance", async () => {
    const id = await makeInstance();
    dataCache.set(`movies:${id}:manual`, { flagged: ["x"] });
    dataCache.set(`movies:999:manual`, { flagged: ["y"] });

    const res = await refresh(
      new NextRequest(`http://localhost/api/instances/${id}/refresh`, {
        method: "POST",
      }),
      ctxFor(id),
    );
    expect(res.status).toBe(200);
    // Entry for our instance is gone; entry for the other instance survived.
    expect(dataCache.get(`movies:${id}:manual`, 60_000)).toBeNull();
    expect(dataCache.get(`movies:999:manual`, 60_000)).not.toBeNull();
  });

  test("404 when instance does not exist (#22)", async () => {
    const res = await refresh(
      new NextRequest("http://localhost/api/instances/99999/refresh", {
        method: "POST",
      }),
      ctxFor(99999),
    );
    expect(res.status).toBe(404);
  });
});
