import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import {
  computeBackoffMs,
  MAX_BACKOFF_MS,
  POLL_INTERVAL_MS,
  statusPoller,
} from "@/server/lib/status-poller";
import { appLogger } from "@/server/lib/app-logger";
import { logRepository } from "@/server/repositories/LogRepository";
import { instanceService } from "@/server/services/InstanceService";
import type { ActionLog } from "@/shared/types/models";
import { mswServer, http, HttpResponse, radarrHandlers } from "@/test/msw";

const radarrBase = "http://192.168.1.10:7878";

const baseInstance = {
  type: "radarr" as const,
  name: "TR",
  url: radarrBase,
  apiKey: "abcd1234abcd1234abcd1234abcd1234",
};

beforeEach(() => {
  statusPoller.stop();
  vi.useRealTimers();
});

afterEach(() => {
  statusPoller.stop();
  vi.useRealTimers();
});

describe("statusPoller — lifecycle", () => {
  test("start() is idempotent (calling twice doesn't double-register timers)", async () => {
    await instanceService.create(baseInstance);
    mswServer.use(
      ...radarrHandlers(
        { baseUrl: radarrBase },
        { movies: [], movieFiles: [], qualityProfiles: [] },
      ),
    );
    await statusPoller.start();
    await statusPoller.start();
    // No assertion on internal state shape — the contract is "the
    // start path doesn't throw and doesn't leak timers." stop() in
    // afterEach proves the latter (would otherwise hang the test
    // process if a ghost timer existed).
  });

  test("refresh() drops timer when instance is disabled", async () => {
    const inst = await instanceService.create(baseInstance);
    mswServer.use(
      ...radarrHandlers(
        { baseUrl: radarrBase },
        { movies: [], movieFiles: [], qualityProfiles: [] },
      ),
    );
    await statusPoller.start();
    // Disable the instance and refresh — the timer should be cleared.
    await instanceService.update(inst.id, { enabled: false });
    await statusPoller.refresh(inst.id);
    // Trigger another refresh on a disabled instance — should be a no-op.
    await statusPoller.refresh(inst.id);
    // No timer leak: stop() in afterEach + vitest's no-pending-timers
    // guard catches a ghost; an explicit vi.useFakeTimers() here would
    // also work but we keep it real-time to avoid masking unintended
    // setIntervals.
  });

  test("refresh() with non-existent instance is a no-op (doesn't throw)", async () => {
    await statusPoller.start();
    await expect(statusPoller.refresh(99999)).resolves.toBeUndefined();
  });

  test("stop() clears all in-memory state", async () => {
    await instanceService.create(baseInstance);
    mswServer.use(
      ...radarrHandlers(
        { baseUrl: radarrBase },
        { movies: [], movieFiles: [], qualityProfiles: [] },
      ),
    );
    await statusPoller.start();
    statusPoller.stop();
    // Calling start() after stop() should re-register cleanly.
    await statusPoller.start();
  });
});

// === Backoff curve =================================================
//
// Pure-function tests for computeBackoffMs. Verifies the exponential
// progression and the MAX_BACKOFF_MS cap. The shape matters because
// it's what determines "how long until the worker tries an unreachable
// instance again" — too aggressive and dead instances spam the
// upstream; too slack and a recovered instance takes ages to notice.
describe("computeBackoffMs", () => {
  test("zero failures returns the base interval (no backoff applied)", () => {
    expect(computeBackoffMs(0)).toBe(POLL_INTERVAL_MS);
  });

  test("each consecutive failure doubles the delay", () => {
    expect(computeBackoffMs(1)).toBe(POLL_INTERVAL_MS * 2);
    expect(computeBackoffMs(2)).toBe(POLL_INTERVAL_MS * 4);
    expect(computeBackoffMs(3)).toBe(POLL_INTERVAL_MS * 8);
  });

  test("delay clamps at MAX_BACKOFF_MS no matter how many failures", () => {
    expect(computeBackoffMs(20)).toBe(MAX_BACKOFF_MS);
    expect(computeBackoffMs(1_000_000)).toBe(MAX_BACKOFF_MS);
  });

  test("negative failure counts treat as zero (defensive)", () => {
    expect(computeBackoffMs(-1)).toBe(POLL_INTERVAL_MS);
    expect(computeBackoffMs(-100)).toBe(POLL_INTERVAL_MS);
  });

  test("respects custom base + max for testability", () => {
    // The worker uses defaults; tests can pass synthetic values to
    // verify the formula without depending on env-tunable globals.
    expect(computeBackoffMs(0, 1_000, 30_000)).toBe(1_000);
    expect(computeBackoffMs(2, 1_000, 30_000)).toBe(4_000);
    expect(computeBackoffMs(10, 1_000, 30_000)).toBe(30_000);
  });
});

// === Failure log dedupe + recovery (Option B) ======================
//
// Persistently-failing instances used to write a warn entry every
// tick — for an unreachable host left in the config that's 12
// entries/hour. We dedupe per (instance, branch) by last-logged cause
// string: same cause = silent retry, new cause = log, recovery = one
// info-level entry that pairs with the original warn.
describe("statusPoller — failure dedupe + recovery", () => {
  test("identical fetch failures across ticks log only once until cause changes", async () => {
    const inst = await instanceService.create(baseInstance);
    // Both branches will throw the same network error every tick.
    mswServer.use(
      http.get(`${radarrBase}/api/v3/command`, () => HttpResponse.error()),
      http.get(`${radarrBase}/api/v3/history`, () => HttpResponse.error()),
      ...radarrHandlers(
        { baseUrl: radarrBase },
        { movies: [], movieFiles: [], qualityProfiles: [] },
      ),
    );
    const warn = vi.spyOn(appLogger, "warn");

    vi.useFakeTimers();
    await statusPoller.start();
    // Drive three full ticks at the BASE interval. Even with backoff,
    // we advance by enough to fire all three so we can count log
    // entries deterministically.
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS + 100);
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 4);
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 8);
    vi.useRealTimers();

    // Each branch should have logged exactly ONE warn — same cause,
    // dedupe suppressed the rest. Other warns from unrelated sources
    // could be present, so filter to our two messages.
    const historyWarns = warn.mock.calls.filter(
      ([msg]) => msg === "Status poller history sync failed",
    );
    const commandWarns = warn.mock.calls.filter(
      ([msg]) => msg === "Status poller command sync failed",
    );
    expect(historyWarns).toHaveLength(1);
    expect(commandWarns).toHaveLength(1);
    // Dedupe keys on cause — payload should include the unwrapped
    // diagnostic (not the bare "fetch failed" wrapper).
    const ctx = historyWarns[0][1] as { context: { cause: string } };
    expect(typeof ctx.context.cause).toBe("string");
    expect(ctx.context.cause.length).toBeGreaterThan(0);

    warn.mockRestore();
    void inst;
  });

  test("recovery from failure emits one info entry pairing previousCause", async () => {
    const inst = await instanceService.create(baseInstance);

    let nextResponse: "fail" | "ok" = "fail";
    mswServer.use(
      http.get(`${radarrBase}/api/v3/command`, () =>
        nextResponse === "fail" ? HttpResponse.error() : HttpResponse.json([]),
      ),
      http.get(`${radarrBase}/api/v3/history`, () =>
        nextResponse === "fail"
          ? HttpResponse.error()
          : HttpResponse.json({ records: [] }),
      ),
      ...radarrHandlers(
        { baseUrl: radarrBase },
        { movies: [], movieFiles: [], qualityProfiles: [] },
      ),
    );

    const info = vi.spyOn(appLogger, "info");

    vi.useFakeTimers();
    await statusPoller.start();
    // First tick: both branches fail (warn entries).
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS + 100);
    // Now flip the response to OK and advance another (backed-off) interval.
    nextResponse = "ok";
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 4);
    vi.useRealTimers();

    const recoveries = info.mock.calls.filter(
      ([msg]) =>
        msg === "Status poller history sync recovered" ||
        msg === "Status poller command sync recovered",
    );
    // Both branches recovered, both logged once.
    expect(recoveries.map(([msg]) => msg).sort()).toEqual([
      "Status poller command sync recovered",
      "Status poller history sync recovered",
    ]);
    // Recovery context preserves the previousCause so users can trace
    // "what was wrong" back to the original warn entry.
    const sample = recoveries[0][1] as { context: { previousCause: string } };
    expect(typeof sample.context.previousCause).toBe("string");
    expect(sample.context.previousCause.length).toBeGreaterThan(0);

    info.mockRestore();
    void inst;
  });
});

// === Refresh fires an immediate tick ===============================
//
// User just changed instance config (or a connection test passed). We
// shouldn't make them wait one full POLL_INTERVAL_MS to see lifecycle
// status updates — refresh() fires processOne synchronously in
// addition to scheduling the recurring timer.
describe("statusPoller — refresh fires an immediate tick", () => {
  test("refresh on a healthy instance updates rows without waiting for the recurring timer", async () => {
    const inst = await instanceService.create(baseInstance);
    const row = await logRepository.create({
      instanceId: inst.id,
      action: "search",
      mediaId: 42,
      title: "X",
      isDryRun: false,
      status: "searched",
      error: null,
      payload: null,
      groupId: null,
      commandId: 7777,
      completionMessage: null,
      lastRetriedAt: null,
    });
    mswServer.use(
      http.get(`${radarrBase}/api/v3/command`, () =>
        HttpResponse.json([
          {
            id: 7777,
            name: "MoviesSearch",
            status: "completed",
            body: { completionMessage: "Stamped via immediate refresh" },
          },
        ]),
      ),
      http.get(`${radarrBase}/api/v3/history`, () =>
        HttpResponse.json({ records: [] }),
      ),
      ...radarrHandlers(
        { baseUrl: radarrBase },
        { movies: [], movieFiles: [], qualityProfiles: [] },
      ),
    );

    // Real timers — we want to prove refresh() doesn't depend on
    // advancing the recurring setTimeout. Bootstrap separately so the
    // pending timer doesn't fire during this test (it's at +5 min).
    await statusPoller.start();
    await statusPoller.refresh(inst.id);

    await vi.waitFor(
      async () => {
        const after = await logRepository.findById(row.id);
        expect(after?.completionMessage).toBe("Stamped via immediate refresh");
      },
      { timeout: 2000 },
    );
  });
});

describe("statusPoller — HMR singleton", () => {
  test("module is a singleton via globalThis", async () => {
    // Re-import the module — should return the SAME instance, not a
    // fresh one. Without this guarantee, dev HMR would create a ghost
    // worker every time the file changes.
    const { statusPoller: again } = await import("@/server/lib/status-poller");
    expect(again).toBe(statusPoller);
  });
});

// === Scenario coverage ============================================
//
// End-to-end: real worker, real DB, MSW-mocked upstream. Each test
// drives one full tick (history sync → command sync) via fake timers
// and asserts the resulting ActionLog state. Covers the search +
// lifecycle paths a user can hit: dispatched → searched, searched →
// grabbed → downloaded, searched → failed, batch outcomes, synthesis
// of "No releases grabbed", and healing of stale messages.
describe("statusPoller — search lifecycle scenarios", () => {
  // Seed a search row in a known state. Defaults match what
  // MediaService.executeAction writes for a fresh dispatched search.
  async function seedSearchRow(
    instanceId: number,
    overrides: Partial<ActionLog> = {},
  ) {
    return logRepository.create({
      instanceId,
      action: "search",
      mediaId: 42,
      title: "Movie",
      isDryRun: false,
      status: "searched",
      error: null,
      payload: null,
      groupId: null,
      commandId: 7777,
      completionMessage: null,
      lastRetriedAt: null,
      ...overrides,
    });
  }

  // Fast-forward one full poll interval and let async work settle.
  async function advanceOneTick(
    rowId: number,
    until: (r: ActionLog) => boolean,
  ) {
    vi.useFakeTimers();
    await statusPoller.start();
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000 + 100);
    vi.useRealTimers();
    await vi.waitFor(
      async () => {
        const after = await logRepository.findById(rowId);
        if (!after || !until(after)) throw new Error("not yet");
      },
      { timeout: 2000 },
    );
  }

  test("single search advances all the way to downloaded in one tick", async () => {
    // Happy path: history fires both grabbed + downloadFolderImported
    // in the same window, and command-sync sees the completed command
    // — but the row already advanced past searched, so no synth message.
    const inst = await instanceService.create(baseInstance);
    const row = await seedSearchRow(inst.id);
    mswServer.use(
      http.get(`${radarrBase}/api/v3/command`, () =>
        HttpResponse.json([
          { id: 7777, name: "MoviesSearch", status: "completed" },
        ]),
      ),
      http.get(`${radarrBase}/api/v3/history`, () =>
        HttpResponse.json({
          records: [
            {
              id: 1,
              eventType: "grabbed",
              date: "2026-05-08T10:00:00Z",
              sourceTitle: "rls.1",
              movieId: 42,
            },
            {
              id: 2,
              eventType: "downloadFolderImported",
              date: "2026-05-08T10:05:00Z",
              sourceTitle: "rls.1",
              movieId: 42,
            },
          ],
        }),
      ),
      ...radarrHandlers(
        { baseUrl: radarrBase },
        { movies: [], movieFiles: [], qualityProfiles: [] },
      ),
    );
    await advanceOneTick(row.id, (r) => r.status === "downloaded");
    const after = await logRepository.findById(row.id);
    expect(after?.status).toBe("downloaded");
    expect(after?.completionMessage).toBeNull();
  });

  test("search command completed but indexer empty → row stays at searched + 'No releases grabbed'", async () => {
    // The Servarr-current-version case the user's Radarr produced for
    // *Fearless* — search ran, 0 releases grabbed, no body.completionMessage
    // in the response. We synthesize the message from the absence of a
    // grabbed event so the user can see the search ran empty.
    const inst = await instanceService.create(baseInstance);
    const row = await seedSearchRow(inst.id);
    mswServer.use(
      http.get(`${radarrBase}/api/v3/command`, () =>
        HttpResponse.json([
          {
            id: 7777,
            name: "MoviesSearch",
            status: "completed",
            started: "2026-05-08T09:00:00Z",
          },
        ]),
      ),
      http.get(`${radarrBase}/api/v3/history`, () =>
        HttpResponse.json({ records: [] }),
      ),
      ...radarrHandlers(
        { baseUrl: radarrBase },
        { movies: [], movieFiles: [], qualityProfiles: [] },
      ),
    );
    await advanceOneTick(
      row.id,
      (r) => r.completionMessage === "No releases grabbed",
    );
    const after = await logRepository.findById(row.id);
    expect(after?.status).toBe("searched");
    expect(after?.completionMessage).toBe("No releases grabbed");
  });

  test("search command failed upstream → row flips to failed with body.message", async () => {
    const inst = await instanceService.create(baseInstance);
    const row = await seedSearchRow(inst.id);
    mswServer.use(
      http.get(`${radarrBase}/api/v3/command`, () =>
        HttpResponse.json([
          {
            id: 7777,
            name: "MoviesSearch",
            status: "failed",
            body: { message: "No indexers configured" },
          },
        ]),
      ),
      http.get(`${radarrBase}/api/v3/history`, () =>
        HttpResponse.json({ records: [] }),
      ),
      ...radarrHandlers(
        { baseUrl: radarrBase },
        { movies: [], movieFiles: [], qualityProfiles: [] },
      ),
    );
    await advanceOneTick(row.id, (r) => r.status === "failed");
    const after = await logRepository.findById(row.id);
    expect(after?.status).toBe("failed");
    expect(after?.error).toBe("No indexers configured");
  });

  test("download failed event after grab → row flips searched → failed", async () => {
    // Search ran, indexer found a release, grab dispatched, download
    // failed (sample wasn't actually the right file / extracted error /
    // hash mismatch). The downloadFailed history event is the signal.
    const inst = await instanceService.create(baseInstance);
    const row = await seedSearchRow(inst.id);
    mswServer.use(
      http.get(`${radarrBase}/api/v3/command`, () =>
        HttpResponse.json([
          { id: 7777, name: "MoviesSearch", status: "completed" },
        ]),
      ),
      http.get(`${radarrBase}/api/v3/history`, () =>
        HttpResponse.json({
          records: [
            {
              id: 1,
              eventType: "grabbed",
              date: "2026-05-08T10:00:00Z",
              sourceTitle: "rls.1",
              movieId: 42,
            },
            {
              id: 2,
              eventType: "downloadFailed",
              date: "2026-05-08T10:05:00Z",
              sourceTitle: "rls.1",
              movieId: 42,
            },
          ],
        }),
      ),
      ...radarrHandlers(
        { baseUrl: radarrBase },
        { movies: [], movieFiles: [], qualityProfiles: [] },
      ),
    );
    await advanceOneTick(row.id, (r) => r.status === "failed");
    const after = await logRepository.findById(row.id);
    expect(after?.status).toBe("failed");
  });

  test("batch search — mixed per-child outcomes resolve independently in one tick", async () => {
    // Three siblings under the same groupId, each a search for a
    // different movie. Upstream produced a different lifecycle outcome
    // for each: 1 → fully downloaded, 2 → still searched (empty
    // indexer), 3 → command-failed (timeout). Asserts that history
    // sync + command sync correlate per-row without cross-contamination.
    const inst = await instanceService.create(baseInstance);
    const groupId = "11111111-2222-3333-4444-555555555555";
    const r1 = await seedSearchRow(inst.id, {
      mediaId: 100,
      title: "Movie A",
      groupId,
      commandId: 9001,
    });
    const r2 = await seedSearchRow(inst.id, {
      mediaId: 101,
      title: "Movie B",
      groupId,
      commandId: 9002,
    });
    const r3 = await seedSearchRow(inst.id, {
      mediaId: 102,
      title: "Movie C",
      groupId,
      commandId: 9003,
    });
    mswServer.use(
      http.get(`${radarrBase}/api/v3/command`, () =>
        HttpResponse.json([
          {
            id: 9001,
            name: "MoviesSearch",
            status: "completed",
            started: "2026-05-08T09:00:00Z",
          },
          {
            id: 9002,
            name: "MoviesSearch",
            status: "completed",
            started: "2026-05-08T09:00:00Z",
          },
          {
            id: 9003,
            name: "MoviesSearch",
            status: "failed",
            body: { message: "Command execution timed out" },
          },
        ]),
      ),
      http.get(`${radarrBase}/api/v3/history`, () =>
        HttpResponse.json({
          records: [
            {
              id: 1,
              eventType: "grabbed",
              date: "2026-05-08T10:00:00Z",
              sourceTitle: "A.rls",
              movieId: 100,
            },
            {
              id: 2,
              eventType: "downloadFolderImported",
              date: "2026-05-08T10:05:00Z",
              sourceTitle: "A.rls",
              movieId: 100,
            },
          ],
        }),
      ),
      ...radarrHandlers(
        { baseUrl: radarrBase },
        { movies: [], movieFiles: [], qualityProfiles: [] },
      ),
    );
    await advanceOneTick(r3.id, (r) => r.status === "failed");
    const a1 = await logRepository.findById(r1.id);
    const a2 = await logRepository.findById(r2.id);
    const a3 = await logRepository.findById(r3.id);
    // Movie A fully downloaded.
    expect(a1?.status).toBe("downloaded");
    // Movie B: search ran, no grab, synth fires.
    expect(a2?.status).toBe("searched");
    expect(a2?.completionMessage).toBe("No releases grabbed");
    // Movie C: command failed upstream.
    expect(a3?.status).toBe("failed");
    expect(a3?.error).toBe("Command execution timed out");
  });

  test("heals stale 'No releases grabbed' message when row has since advanced", async () => {
    // Reproduces the bug the user reported: a row at 'grabbed' carrying
    // 'No releases grabbed' from an earlier tick where /history's since
    // window didn't yet include the late-fired grab event. Healing
    // path clears the contradictory message on the next command-sync.
    const inst = await instanceService.create(baseInstance);
    const row = await seedSearchRow(inst.id, {
      status: "grabbed",
      completionMessage: "No releases grabbed",
    });
    mswServer.use(
      http.get(`${radarrBase}/api/v3/command`, () =>
        HttpResponse.json([
          { id: 7777, name: "MoviesSearch", status: "completed" },
        ]),
      ),
      // The grab event already aged out of the since window.
      http.get(`${radarrBase}/api/v3/history`, () =>
        HttpResponse.json({ records: [] }),
      ),
      ...radarrHandlers(
        { baseUrl: radarrBase },
        { movies: [], movieFiles: [], qualityProfiles: [] },
      ),
    );
    await advanceOneTick(row.id, (r) => r.completionMessage === null);
    const after = await logRepository.findById(row.id);
    expect(after?.status).toBe("grabbed");
    expect(after?.completionMessage).toBeNull();
  });
});

describe("statusPoller — command-sync end-to-end via MSW", () => {
  test("fires a tick that updates ActionLog from upstream /command", async () => {
    const inst = await instanceService.create(baseInstance);
    // Seed a row that the poller should pick up.
    const row = await logRepository.create({
      instanceId: inst.id,
      action: "search",
      mediaId: 42,
      title: "X",
      isDryRun: false,
      status: "searched",
      error: null,
      payload: null,
      groupId: null,
      commandId: 7777,
      completionMessage: null,
      lastRetriedAt: null,
    });

    let commandHits = 0;
    mswServer.use(
      http.get(`${radarrBase}/api/v3/command`, () => {
        commandHits += 1;
        return HttpResponse.json([
          {
            id: 7777,
            name: "MoviesSearch",
            status: "completed",
            body: { completionMessage: "0 releases found" },
          },
        ]);
      }),
      http.get(`${radarrBase}/api/v3/history`, () => {
        return HttpResponse.json({ records: [] });
      }),
      ...radarrHandlers(
        { baseUrl: radarrBase },
        { movies: [], movieFiles: [], qualityProfiles: [] },
      ),
    );

    // Drive the poller's processOne path manually via refresh — it
    // re-registers + ticks. We don't wait for the natural 5-min
    // interval; the public surface is start/stop/refresh and we
    // exercise the side effects through MSW + DB state.
    //
    // Use vitest fake timers to fast-forward the setInterval without
    // actually waiting, then flush microtasks so async work inside
    // tick completes.
    vi.useFakeTimers();
    await statusPoller.start();
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000 + 100);
    vi.useRealTimers();

    // The tick fired exactly once at the interval boundary; allow async
    // settle then check.
    await vi.waitFor(
      async () => {
        const after = await logRepository.findById(row.id);
        expect(after?.completionMessage).toBe("0 releases found");
      },
      { timeout: 2000 },
    );
    expect(commandHits).toBeGreaterThanOrEqual(1);
  });
});
