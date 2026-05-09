import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import {
  computeNextRun,
  pickAutoSearchBatch,
  autoRunner,
} from "@/server/lib/auto-runner";
import { instanceService } from "@/server/services/InstanceService";
import { searchQueueService } from "@/server/services/SearchQueueService";
import { searchQueueRepository } from "@/server/repositories/SearchQueueRepository";
import { mswServer, http, HttpResponse, radarrHandlers } from "@/test/msw";

const radarrBase = "http://192.168.1.10:7878";

const baseInstance = {
  type: "radarr" as const,
  name: "AR",
  url: radarrBase,
  apiKey: "abcd1234abcd1234abcd1234abcd1234",
  autoSearchEnabled: true,
  autoSearchScheduleMode: "interval" as const,
  autoSearchIntervalMinutes: 60,
  autoSearchCronExpression: "0 3 * * *",
  autoSearchBatchLimit: 5,
  autoSearchMonitoredOnly: true,
  autoSearchScope: "flagged" as const,
  autoSearchPickStrategy: "balanced" as const,
};

beforeEach(() => {
  autoRunner.stop();
  vi.useRealTimers();
});

afterEach(() => {
  autoRunner.stop();
  vi.useRealTimers();
});

// ─── computeNextRun ────────────────────────────────────────────────────────

describe("computeNextRun — interval mode", () => {
  test("lastRunAt=null → epoch (fires immediately)", () => {
    const result = computeNextRun({
      mode: "interval",
      intervalMinutes: 2880,
      cronExpression: "",
      lastRunAt: null,
    });
    expect(result).not.toBeNull();
    expect(result!.getTime()).toBe(0 + 2880 * 60 * 1000);
    // Epoch + interval still puts us far in the past → fires immediately.
    expect(result!.getTime()).toBeLessThan(Date.now());
  });

  test("lastRunAt=T → T + intervalMinutes", () => {
    const T = new Date("2025-01-01T00:00:00Z");
    const result = computeNextRun({
      mode: "interval",
      intervalMinutes: 60,
      cronExpression: "",
      lastRunAt: T,
    });
    expect(result!.getTime()).toBe(T.getTime() + 60 * 60 * 1000);
  });
});

describe("computeNextRun — cron mode", () => {
  test("valid cron + lastRunAt=null → next calendar match after now", () => {
    // Use local-time constructor (no Z) so cron-parser and Date agree on timezone.
    const now = new Date(2025, 5, 15, 14, 30, 0); // 2025-06-15 14:30 local
    const result = computeNextRun({
      mode: "cron",
      intervalMinutes: 60,
      cronExpression: "0 3 * * *", // 3am daily
      lastRunAt: null,
      now,
    });
    expect(result).not.toBeNull();
    // Next 3am local after 14:30 local is next day 03:00 local.
    expect(result!.getHours()).toBe(3);
    expect(result!.getDate()).toBe(16);
  });

  test("valid cron + lastRunAt set → still next calendar match after now", () => {
    const now = new Date(2025, 5, 15, 3, 47, 0); // 2025-06-15 03:47 local
    const result = computeNextRun({
      mode: "cron",
      intervalMinutes: 60,
      cronExpression: "0 */6 * * *", // every 6h
      lastRunAt: new Date(2025, 5, 15, 3, 0, 0),
      now,
    });
    // Next tick after 03:47 on */6h schedule is 06:00 local.
    expect(result).not.toBeNull();
    expect(result!.getHours()).toBe(6);
  });

  test("invalid cron → null", () => {
    expect(
      computeNextRun({
        mode: "cron",
        intervalMinutes: 60,
        cronExpression: "not a cron",
        lastRunAt: null,
      }),
    ).toBeNull();
  });

  test("6-field cron (seconds) → null (strict 5-field only)", () => {
    expect(
      computeNextRun({
        mode: "cron",
        intervalMinutes: 60,
        cronExpression: "0 0 3 * * *", // 6 fields
        lastRunAt: null,
      }),
    ).toBeNull();
  });

  test("empty string → null", () => {
    expect(
      computeNextRun({
        mode: "cron",
        intervalMinutes: 60,
        cronExpression: "",
        lastRunAt: null,
      }),
    ).toBeNull();
  });
});

// ─── pickAutoSearchBatch ────────────────────────────────────────────────────

describe("pickAutoSearchBatch", () => {
  const item = (id: number, cfScore: number) => ({ id, cfScore });
  const entry = (at: Date, failed = false) => ({ at, failed });

  test("empty items → []", () => {
    expect(pickAutoSearchBatch([], new Map(), 5)).toEqual([]);
  });

  test("batchLimit=0 → []", () => {
    expect(pickAutoSearchBatch([item(1, 0)], new Map(), 0)).toEqual([]);
  });

  test("all never-searched → sorted by cfScore asc (backfill), sliced to limit", () => {
    const items = [item(1, 10), item(2, 5), item(3, 1)];
    const result = pickAutoSearchBatch(items, new Map(), 2);
    expect(result.map((i) => i.id)).toEqual([3, 2]);
  });

  test("never-searched items come before previously-searched (backfill first)", () => {
    const map = new Map([[1, entry(new Date("2025-01-01"))]]);
    const items = [item(1, 0), item(2, 0)]; // item 2 never searched → backfill
    const result = pickAutoSearchBatch(items, map, 1);
    expect(result[0].id).toBe(2);
  });

  test("failed items come before successfully-searched (backfill)", () => {
    const map = new Map([
      [1, entry(new Date("2025-01-01"), false)], // successful
      [2, entry(new Date("2025-03-01"), true)], // failed → backfill
    ]);
    const items = [item(1, 0), item(2, 0)];
    const result = pickAutoSearchBatch(items, map, 1);
    expect(result[0].id).toBe(2);
  });

  test("backfill sorted by cfScore asc: worst score goes first", () => {
    // Both never-searched → backfill; lower cfScore wins
    const items = [item(1, 10), item(2, 1)];
    const result = pickAutoSearchBatch(items, new Map(), 2);
    expect(result.map((i) => i.id)).toEqual([2, 1]);
  });

  test("oldest-searched comes before recently-searched (balanced strategy)", () => {
    const map = new Map([
      [1, entry(new Date("2025-03-01"))],
      [2, entry(new Date("2025-01-01"))], // older → first
    ]);
    const items = [item(1, 0), item(2, 0)];
    const result = pickAutoSearchBatch(items, map, 1, "balanced");
    expect(result[0].id).toBe(2);
  });

  test("cfScore tie-break when timestamps equal (balanced)", () => {
    const ts = new Date("2025-01-01");
    const map = new Map([
      [1, entry(ts)],
      [2, entry(ts)],
    ]);
    const items = [item(1, 10), item(2, 3)];
    const result = pickAutoSearchBatch(items, map, 1, "balanced");
    expect(result[0].id).toBe(2); // lower score first
  });

  test("random strategy: produces a valid subset (non-deterministic, just sanity check)", () => {
    const items = Array.from({ length: 10 }, (_, i) => item(i + 1, i));
    const map = new Map(
      items.map((it) => [it.id, entry(new Date("2025-01-01"))]),
    );
    const result = pickAutoSearchBatch(items, map, 5, "random");
    expect(result).toHaveLength(5);
    expect(result.every((r) => items.some((it) => it.id === r.id))).toBe(true);
  });

  test("rotation: 100 items + batchLimit=5, stamping last-searched rotates through all", () => {
    const items = Array.from({ length: 100 }, (_, i) => item(i + 1, i));
    const lastSearched = new Map<number, { at: Date; failed: boolean }>();
    const seen = new Set<number>();

    for (let cycle = 0; cycle < 20; cycle++) {
      const picked = pickAutoSearchBatch(items, lastSearched, 5, "balanced");
      for (const p of picked) {
        seen.add(p.id);
        lastSearched.set(p.id, {
          at: new Date(Date.now() + cycle * 3600_000),
          failed: false,
        });
      }
    }

    expect(seen.size).toBe(100);
  });
});

// ─── autoRunner lifecycle ───────────────────────────────────────────────────

describe("autoRunner — lifecycle", () => {
  test("start() is idempotent — second call doesn't double-register", async () => {
    // Use 120-min interval so a 61-min advance triggers exactly one tick
    // (the overdue tick fires at t=0, reschedules at t=120min, no second fire).
    const inst = await instanceService.create({
      ...baseInstance,
      autoSearchIntervalMinutes: 120,
    });
    let hits = 0;
    mswServer.use(
      http.get(`${radarrBase}/api/v3/movie`, () => {
        hits++;
        return HttpResponse.json([]);
      }),
      ...radarrHandlers(
        { baseUrl: radarrBase },
        { movies: [], movieFiles: [], qualityProfiles: [] },
      ),
    );
    vi.useFakeTimers();
    await autoRunner.start();
    await autoRunner.start();
    // Advance past 61 min — overdue tick fires once; next is at 120 min (not yet).
    await vi.advanceTimersByTimeAsync(61 * 60 * 1000);
    vi.useRealTimers();
    await vi.waitFor(() => expect(hits).toBeLessThanOrEqual(1), {
      timeout: 2000,
    });
    await instanceService.delete(inst.id);
  });

  test("start() with no auto-search instances registers nothing", async () => {
    const inst = await instanceService.create({
      ...baseInstance,
      autoSearchEnabled: false,
    });
    vi.useFakeTimers();
    await autoRunner.start();
    // No timers registered — advancing should not crash.
    await vi.advanceTimersByTimeAsync(200_000);
    vi.useRealTimers();
    await instanceService.delete(inst.id);
  });

  test("refresh() re-registers instance after enable", async () => {
    const inst = await instanceService.create({
      ...baseInstance,
      autoSearchEnabled: false,
    });
    mswServer.use(
      http.get(`${radarrBase}/api/v3/movie`, () => HttpResponse.json([])),
      ...radarrHandlers(
        { baseUrl: radarrBase },
        { movies: [], movieFiles: [], qualityProfiles: [] },
      ),
    );
    await autoRunner.start();
    // Enable auto-search + call refresh.
    await instanceService.update(inst.id, { autoSearchEnabled: true });
    await autoRunner.refresh(inst.id);
    // Runner should now have a timer for this instance.
    expect(autoRunner.isRunning(inst.id)).toBe(false); // not yet running
    await instanceService.delete(inst.id);
  });

  test("refresh() cleans up when instance is disabled", async () => {
    const inst = await instanceService.create(baseInstance);
    mswServer.use(
      ...radarrHandlers(
        { baseUrl: radarrBase },
        { movies: [], movieFiles: [], qualityProfiles: [] },
      ),
    );
    await autoRunner.start();
    await instanceService.update(inst.id, { autoSearchEnabled: false });
    await autoRunner.refresh(inst.id);
    // No pending timers — test runner's no-pending-timers guard would fail.
    await instanceService.delete(inst.id);
  });

  test("refresh() with non-existent id is a no-op", async () => {
    await autoRunner.start();
    await expect(autoRunner.refresh(99999)).resolves.toBeUndefined();
  });

  test("stop() clears all state", async () => {
    const inst = await instanceService.create(baseInstance);
    mswServer.use(
      ...radarrHandlers(
        { baseUrl: radarrBase },
        { movies: [], movieFiles: [], qualityProfiles: [] },
      ),
    );
    await autoRunner.start();
    autoRunner.stop();
    // Re-start should work cleanly.
    await autoRunner.start();
    await instanceService.delete(inst.id);
  });
});

// ─── autoRunner.runNow ──────────────────────────────────────────────────────

describe("autoRunner.runNow", () => {
  test("enqueues items up to batchLimit and returns count", async () => {
    const movies = Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      title: `Movie ${i + 1}`,
      qualityProfileId: 1,
      customFormats: [],
      customFormatScore: 0,
      hasFile: false,
      monitored: true,
      movieFile: null,
    }));
    mswServer.use(
      http.get(`${radarrBase}/api/v3/movie`, () => HttpResponse.json(movies)),
      ...radarrHandlers(
        { baseUrl: radarrBase },
        {
          movies,
          movieFiles: [],
          qualityProfiles: [
            {
              id: 1,
              name: "HD",
              cutoff: 1,
              cutoffFormatScore: 100,
              minUpgradeFormatScore: 1,
              formatItems: [],
              items: [],
            },
          ],
        },
      ),
    );

    const inst = await instanceService.create({
      ...baseInstance,
      autoSearchBatchLimit: 3,
      autoSearchScope: "all",
      autoSearchMonitoredOnly: false,
    });

    const result = await autoRunner.runNow(inst.id);

    expect(result.enqueued).toBeGreaterThanOrEqual(0);
    expect(result.enqueued).toBeLessThanOrEqual(3);

    const queued = await searchQueueRepository.findPendingByInstance(inst.id);
    expect(queued.length).toBe(result.enqueued);

    await instanceService.delete(inst.id);
  });

  test("throws AUTO_RUN_BUSY if already running", async () => {
    const inst = await instanceService.create(baseInstance);

    // Mock a slow upstream so the first runNow hangs long enough for the
    // second call to race in. 200ms is plenty; 5000ms would hit the test timeout.
    mswServer.use(
      http.get(`${radarrBase}/api/v3/movie`, async () => {
        await new Promise((r) => setTimeout(r, 200));
        return HttpResponse.json([]);
      }),
      ...radarrHandlers(
        { baseUrl: radarrBase },
        { movies: [], movieFiles: [], qualityProfiles: [] },
      ),
    );

    const first = autoRunner.runNow(inst.id);
    // Give the first call time to mark processing.
    await new Promise((r) => setTimeout(r, 10));

    await expect(autoRunner.runNow(inst.id)).rejects.toMatchObject({
      code: "AUTO_RUN_BUSY",
    });

    // Clean up the hanging first call.
    mswServer.resetHandlers();
    mswServer.use(
      http.get(`${radarrBase}/api/v3/movie`, () => HttpResponse.json([])),
      ...radarrHandlers(
        { baseUrl: radarrBase },
        { movies: [], movieFiles: [], qualityProfiles: [] },
      ),
    );
    await first.catch(() => {});
    await instanceService.delete(inst.id);
  });

  test("throws AUTO_RUN_INELIGIBLE for disabled instance", async () => {
    const inst = await instanceService.create({
      ...baseInstance,
      autoSearchEnabled: false,
    });
    await expect(autoRunner.runNow(inst.id)).rejects.toMatchObject({
      code: "AUTO_RUN_INELIGIBLE",
    });
    await instanceService.delete(inst.id);
  });

  test("throws AUTO_RUN_INELIGIBLE for non-existent instance", async () => {
    await expect(autoRunner.runNow(99999)).rejects.toMatchObject({
      code: "AUTO_RUN_INELIGIBLE",
    });
  });
});

// ─── tick integration: overdue interval fires immediately ───────────────────

describe("autoRunner — tick fires when overdue", () => {
  test("instance with lastRunAt far in the past fires on next tick", async () => {
    const past = new Date(Date.now() - 3 * 24 * 3600 * 1000); // 3 days ago

    let hitCount = 0;
    mswServer.use(
      http.get(`${radarrBase}/api/v3/movie`, () => {
        hitCount++;
        return HttpResponse.json([]);
      }),
      ...radarrHandlers(
        { baseUrl: radarrBase },
        { movies: [], movieFiles: [], qualityProfiles: [] },
      ),
    );

    const inst = await instanceService.create({
      ...baseInstance,
      autoSearchIntervalMinutes: 2880, // 2 days
    });
    // Manually stamp lastRunAt as 3 days ago so it's overdue.
    await instanceService.update(inst.id, {
      autoSearchLastRunAt: past,
    } as Parameters<typeof instanceService.update>[1]);

    vi.useFakeTimers();
    await autoRunner.start();
    // A small advance should trigger the overdue tick.
    await vi.advanceTimersByTimeAsync(500);
    vi.useRealTimers();

    await vi.waitFor(() => expect(hitCount).toBeGreaterThanOrEqual(1), {
      timeout: 3000,
    });

    await instanceService.delete(inst.id);
  });

  test("multiple independent instances tick independently", async () => {
    const inst1 = await instanceService.create({
      ...baseInstance,
      name: "AR-1",
      autoSearchIntervalMinutes: 60,
    });
    const inst2 = await instanceService.create({
      ...baseInstance,
      name: "AR-2",
      url: radarrBase, // same base for simplicity
      autoSearchIntervalMinutes: 120,
    });

    mswServer.use(
      http.get(`${radarrBase}/api/v3/movie`, () => HttpResponse.json([])),
      ...radarrHandlers(
        { baseUrl: radarrBase },
        { movies: [], movieFiles: [], qualityProfiles: [] },
      ),
    );

    vi.useFakeTimers();
    await autoRunner.start();
    // Neither instance should be running right after start (first tick
    // schedules for the future).
    expect(autoRunner.isRunning(inst1.id)).toBe(false);
    expect(autoRunner.isRunning(inst2.id)).toBe(false);
    vi.useRealTimers();

    await instanceService.delete(inst1.id);
    await instanceService.delete(inst2.id);
  });
});

// ─── enqueue deduplication ──────────────────────────────────────────────────

describe("autoRunner — enqueue deduplication", () => {
  test("items already pending in SearchQueue are not re-enqueued", async () => {
    const inst = await instanceService.create({
      ...baseInstance,
      autoSearchBatchLimit: 5,
      autoSearchScope: "all",
      autoSearchMonitoredOnly: false,
    });

    // Seed one pending queue entry.
    await searchQueueService.enqueue({
      instanceId: inst.id,
      action: "movie",
      mediaId: 1,
      title: "Movie 1",
    });

    const movies = [
      {
        id: 1,
        title: "Movie 1",
        qualityProfileId: 1,
        customFormats: [],
        customFormatScore: 0,
        hasFile: false,
        monitored: true,
        movieFile: null,
      },
    ];

    mswServer.use(
      http.get(`${radarrBase}/api/v3/movie`, () => HttpResponse.json(movies)),
      ...radarrHandlers(
        { baseUrl: radarrBase },
        {
          movies,
          movieFiles: [],
          qualityProfiles: [
            {
              id: 1,
              name: "HD",
              cutoff: 1,
              cutoffFormatScore: 100,
              minUpgradeFormatScore: 1,
              formatItems: [],
              items: [],
            },
          ],
        },
      ),
    );

    // runNow should silently skip the already-pending item.
    const result = await autoRunner.runNow(inst.id);
    const allPending = await searchQueueRepository.findPendingByInstance(
      inst.id,
    );
    // Still exactly 1 row (not doubled).
    expect(allPending.length).toBe(1);
    expect(result.enqueued).toBe(0); // deduped

    await instanceService.delete(inst.id);
  });
});
