import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import {
  __resetReleaseCacheForTests,
  getLatestRelease,
  isCacheFresh,
} from "@/server/lib/github-release";

const ORIGINAL_FETCH = globalThis.fetch;

function mockJsonResponse(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response);
}

beforeEach(() => {
  __resetReleaseCacheForTests();
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  vi.useRealTimers();
});

describe("getLatestRelease", () => {
  test("hits GitHub on first call and caches the response", async () => {
    const fetchSpy = vi.fn(() =>
      mockJsonResponse({ tag_name: "v0.2.0", html_url: "https://example/r" }),
    );
    globalThis.fetch = fetchSpy as typeof fetch;

    const first = await getLatestRelease();
    expect(first.release?.tag).toBe("v0.2.0");
    expect(first.release?.htmlUrl).toBe("https://example/r");
    expect(first.isStale).toBe(false);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Second call within TTL — served from cache, no extra fetch.
    const second = await getLatestRelease();
    expect(second.release?.tag).toBe("v0.2.0");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(isCacheFresh()).toBe(true);
  });

  test("force=true bypasses the cache even when fresh", async () => {
    const fetchSpy = vi.fn(() =>
      mockJsonResponse({ tag_name: "v0.3.0", html_url: "https://example/r" }),
    );
    globalThis.fetch = fetchSpy as typeof fetch;

    await getLatestRelease();
    await getLatestRelease({ force: true });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  test("returns previous cached value (marked stale) when fetch fails", async () => {
    const fetchSpy = vi
      .fn()
      .mockImplementationOnce(() =>
        mockJsonResponse({ tag_name: "v0.4.0", html_url: "https://example/r" }),
      )
      .mockImplementationOnce(() => Promise.reject(new Error("network down")));
    globalThis.fetch = fetchSpy as typeof fetch;

    const ok = await getLatestRelease();
    expect(ok.release?.tag).toBe("v0.4.0");

    const stale = await getLatestRelease({ force: true });
    expect(stale.release?.tag).toBe("v0.4.0"); // last-known value
    expect(stale.isStale).toBe(true);
  });

  test("returns null when no cached value and fetch fails", async () => {
    globalThis.fetch = vi.fn(() =>
      Promise.reject(new Error("network down")),
    ) as typeof fetch;
    const res = await getLatestRelease();
    expect(res.release).toBeNull();
    expect(res.isStale).toBe(false);
  });

  test("returns null when GitHub responds with non-2xx (e.g. 404)", async () => {
    globalThis.fetch = vi.fn(() =>
      mockJsonResponse({ message: "Not Found" }, 404),
    ) as typeof fetch;
    const res = await getLatestRelease();
    expect(res.release).toBeNull();
  });

  test("returns null when GitHub payload is missing tag_name or html_url", async () => {
    globalThis.fetch = vi.fn(() =>
      mockJsonResponse({ tag_name: "v0.5.0" }),
    ) as typeof fetch;
    const res = await getLatestRelease();
    expect(res.release).toBeNull();
  });

  test("coalesces concurrent calls into a single fetch", async () => {
    let resolveFetch: (v: Response) => void = () => undefined;
    const fetchSpy = vi.fn(
      () =>
        new Promise<Response>((res) => {
          resolveFetch = res;
        }),
    );
    globalThis.fetch = fetchSpy as typeof fetch;

    const p1 = getLatestRelease();
    const p2 = getLatestRelease();
    const p3 = getLatestRelease();

    resolveFetch({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          tag_name: "v0.6.0",
          html_url: "https://example/r",
        }),
    } as Response);

    const [a, b, c] = await Promise.all([p1, p2, p3]);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(a.release?.tag).toBe("v0.6.0");
    expect(b.release?.tag).toBe("v0.6.0");
    expect(c.release?.tag).toBe("v0.6.0");
  });

  test("coalesced callers get the warm cache when the shared fetch fails", async () => {
    // Pre-warm.
    const okSpy = vi.fn(() =>
      mockJsonResponse({
        tag_name: "v0.7.0",
        html_url: "https://example/r",
      }),
    );
    globalThis.fetch = okSpy as typeof fetch;
    await getLatestRelease();

    // Now mount three concurrent forced refreshes against a failing fetch.
    let rejectFetch: (e: Error) => void = () => undefined;
    const failSpy = vi.fn(
      () =>
        new Promise<Response>((_res, rej) => {
          rejectFetch = rej;
        }),
    );
    globalThis.fetch = failSpy as typeof fetch;

    const p1 = getLatestRelease({ force: true });
    const p2 = getLatestRelease({ force: true });
    const p3 = getLatestRelease({ force: true });
    rejectFetch(new Error("upstream down"));

    const [a, b, c] = await Promise.all([p1, p2, p3]);
    expect(failSpy).toHaveBeenCalledTimes(1);
    // All three callers see the warm cached release, marked stale.
    for (const r of [a, b, c]) {
      expect(r.release?.tag).toBe("v0.7.0");
      expect(r.isStale).toBe(true);
    }
  });
});
