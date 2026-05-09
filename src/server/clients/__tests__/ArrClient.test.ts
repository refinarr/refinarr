import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { describeFetchError, ArrClient } from "@/server/clients/ArrClient";
import type {
  UpstreamHistoryRecord,
  UpstreamHistoryEvent,
} from "@/server/clients/ArrClient";
import type { Instance } from "@/shared/types/models";

const stubInstance: Instance = {
  id: 1,
  type: "radarr",
  name: "Test",
  url: "http://localhost:7878",
  apiKey: "key",
  enabled: true,
  scoringMode: "profile",
  searchesPerHour: 20,
  showAllMedia: false,
  createdAt: new Date(),
  autoSearchEnabled: false,
  autoSearchScheduleMode: "interval",
  autoSearchIntervalMinutes: 1440,
  autoSearchCronExpression: "0 3 * * *",
  autoSearchBatchLimit: 5,
  autoSearchLastRunAt: null,
  autoSearchMonitoredOnly: true,
  autoSearchScope: "flagged",
  autoSearchPickStrategy: "balanced",
};

class TestClient extends ArrClient {
  getQualityProfiles() {
    return Promise.resolve([]);
  }
  triggerSearch() {
    return Promise.resolve({ commandId: 0 });
  }
  deleteFile() {
    return Promise.resolve();
  }
  protected projectHistoryRecord(
    _r: UpstreamHistoryRecord,
  ): { mediaId: number; scope: UpstreamHistoryEvent["scope"] } | null {
    return null;
  }
  callFetch<T>(path: string, init?: RequestInit) {
    return this.fetch<T>(path, init);
  }
}

describe("ArrClient.fetch timeout", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ version: "1" }), {
        headers: { "content-type": "application/json" },
      }),
    );
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  test("passes an AbortSignal to every upstream fetch", async () => {
    const client = new TestClient(stubInstance);
    await client.callFetch("/system/status");
    const [, init] = fetchSpy.mock.calls[0];
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  test("respects a caller-supplied signal over the default timeout", async () => {
    const client = new TestClient(stubInstance);
    const callerSignal = AbortSignal.timeout(60_000);
    await client.callFetch("/system/status", { signal: callerSignal });
    const [, init] = fetchSpy.mock.calls[0];
    expect(init?.signal).toBe(callerSignal);
  });
});

// Node's fetch wraps every network failure as `TypeError: fetch failed`,
// hiding the real cause on `error.cause`. The statusPoller worker logs
// per-instance fetch failures via this helper so /logs entries name the
// actual diagnostic ("ECONNREFUSED" / "ENOTFOUND" / etc.) instead of
// the useless wrapper. A miss here = silent regression in user-facing
// observability — worth a few cheap tests.
describe("describeFetchError", () => {
  test("unwraps Node fetch's `cause` and includes its code", () => {
    const cause = Object.assign(new Error("connect ECONNREFUSED 1.2.3.4:80"), {
      code: "ECONNREFUSED",
    });
    const wrapped = Object.assign(new TypeError("fetch failed"), { cause });
    expect(describeFetchError(wrapped)).toBe(
      "connect ECONNREFUSED 1.2.3.4:80 (ECONNREFUSED)",
    );
  });

  test("falls back to cause.message when no code is present", () => {
    const cause = new Error("DNS lookup failed");
    const wrapped = Object.assign(new TypeError("fetch failed"), { cause });
    expect(describeFetchError(wrapped)).toBe("DNS lookup failed");
  });

  test("returns the outer message when there is no cause", () => {
    expect(describeFetchError(new Error("AbortError"))).toBe("AbortError");
  });

  test("stringifies non-Error throwables (defensive)", () => {
    expect(describeFetchError("boom")).toBe("boom");
    expect(describeFetchError({ weird: true })).toBe("[object Object]");
  });
});
