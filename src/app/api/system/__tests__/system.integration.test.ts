import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { __resetReleaseCacheForTests } from "@/server/lib/github-release";
import { GET } from "@/app/api/system/route";

const ctxNone = { params: Promise.resolve({}) };
const ORIGINAL_FETCH = globalThis.fetch;

function req(query = "") {
  return new NextRequest(`http://localhost/api/system${query}`, {
    method: "GET",
  });
}

beforeEach(() => {
  __resetReleaseCacheForTests();
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
});

describe("GET /api/system", () => {
  test("returns the SystemInfo shape", async () => {
    globalThis.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            tag_name: "v0.9.0",
            html_url: "https://example/r",
          }),
      } as Response),
    ) as typeof fetch;

    const res = await GET(req(), ctxNone);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(
      expect.objectContaining({
        version: expect.any(String),
        bootedAtMs: expect.any(Number),
        node: expect.any(String),
        platform: expect.any(String),
        latestRelease: expect.objectContaining({
          tag: "v0.9.0",
          htmlUrl: "https://example/r",
          checkedAtMs: expect.any(Number),
          isStale: false,
        }),
      }),
    );
  });

  test("returns latestRelease=null when GitHub fetch fails on a cold cache", async () => {
    globalThis.fetch = vi.fn(() =>
      Promise.reject(new Error("down")),
    ) as typeof fetch;
    const res = await GET(req(), ctxNone);
    const body = await res.json();
    expect(body.latestRelease).toBeNull();
  });

  test("?refresh=1 forces a fresh GitHub call (bypasses cache)", async () => {
    const fetchSpy = vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            tag_name: "v1.0.0",
            html_url: "https://example/r",
          }),
      } as Response),
    );
    globalThis.fetch = fetchSpy as typeof fetch;

    await GET(req(), ctxNone); // fills cache
    await GET(req(), ctxNone); // cache hit, no extra fetch
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    await GET(req("?refresh=1"), ctxNone); // bypass
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  test("bootedAtMs is stable across calls (read once at module load)", async () => {
    globalThis.fetch = vi.fn(() =>
      Promise.reject(new Error("not needed")),
    ) as typeof fetch;
    const a = await (await GET(req(), ctxNone)).json();
    const b = await (await GET(req(), ctxNone)).json();
    expect(a.bootedAtMs).toBe(b.bootedAtMs);
  });
});
