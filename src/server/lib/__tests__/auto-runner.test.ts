import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import {
  computeNextRun,
  pickAutoSearchBatch,
  pickAutoSearchMixedBatch,
  allocateMixedQuota,
  categorizeForMixed,
  buildAutoSearchStatus,
  autoRunner,
} from "@/server/lib/auto-runner";
import { realScheduler } from "@/server/lib/scheduler";
import { instanceService } from "@/server/services/InstanceService";
import { instanceRepository } from "@/server/repositories/InstanceRepository";
import { searchQueueService } from "@/server/services/SearchQueueService";
import { searchQueueRepository } from "@/server/repositories/SearchQueueRepository";
import type { Instance } from "@/shared/types/models";
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

beforeEach(async () => {
  // setup.ts swaps in inertScheduler globally; this suite drives real
  // timers via vitest fake timers, so restore the real scheduler.
  autoRunner.scheduler = realScheduler;
  await autoRunner.stop();
  vi.useRealTimers();
});

afterEach(async () => {
  await autoRunner.stop();
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

// ─── pickAutoSearchBatch — cooldown ────────────────────────────────────────

describe("pickAutoSearchBatch — cooldown filtering", () => {
  const item = (id: number, cfScore: number) => ({ id, cfScore });
  const entry = (at: Date, failed = false) => ({ at, failed });
  const cooldown2h = 2 * 60 * 60 * 1000;

  test("cooldownMs=0 disables filtering — recently-searched items remain eligible", () => {
    const justNow = new Date(Date.now() - 10);
    const map = new Map([
      [1, entry(justNow)],
      [2, entry(justNow)],
    ]);
    const result = pickAutoSearchBatch(
      [item(1, 0), item(2, 0)],
      map,
      10,
      "balanced",
      0,
    );
    expect(result.map((i) => i.id)).toEqual(expect.arrayContaining([1, 2]));
  });

  test("item searched 30 min ago with 2h cooldown → excluded; unsearched item → included", () => {
    const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);
    const map = new Map([[1, entry(thirtyMinsAgo)]]);
    const result = pickAutoSearchBatch(
      [item(1, 0), item(2, 0)],
      map,
      10,
      "balanced",
      cooldown2h,
    );
    expect(result.map((i) => i.id)).not.toContain(1);
    expect(result.map((i) => i.id)).toContain(2);
  });

  test("item searched 3h ago with 2h cooldown → eligible again", () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const map = new Map([[1, entry(threeHoursAgo)]]);
    const result = pickAutoSearchBatch(
      [item(1, 0)],
      map,
      10,
      "balanced",
      cooldown2h,
    );
    expect(result.map((i) => i.id)).toContain(1);
  });

  test("boundary: searched at exactly cooldownMs ago → excluded (not yet elapsed)", () => {
    // Subtract 1ms so it's inside the window, not past it.
    const exactBoundary = new Date(Date.now() - cooldown2h + 1);
    const map = new Map([[1, entry(exactBoundary)]]);
    const result = pickAutoSearchBatch(
      [item(1, 0)],
      map,
      10,
      "balanced",
      cooldown2h,
    );
    expect(result.map((i) => i.id)).not.toContain(1);
  });

  test("failed items bypass cooldown — re-eligible regardless of recency", () => {
    const oneMinAgo = new Date(Date.now() - 60 * 1000);
    const map = new Map([[1, entry(oneMinAgo, true)]]);
    const result = pickAutoSearchBatch(
      [item(1, 0)],
      map,
      10,
      "balanced",
      cooldown2h,
    );
    expect(result.map((i) => i.id)).toContain(1);
  });

  test("all items within cooldown → empty result even with batchLimit > 0", () => {
    const justNow = new Date(Date.now() - 5 * 60 * 1000);
    const map = new Map([
      [1, entry(justNow)],
      [2, entry(justNow)],
      [3, entry(justNow)],
    ]);
    const result = pickAutoSearchBatch(
      [item(1, 0), item(2, 0), item(3, 0)],
      map,
      10,
      "balanced",
      cooldown2h,
    );
    expect(result).toHaveLength(0);
  });

  test("cooldown only removes from candidate pool — batchLimit still applies to remaining", () => {
    const recent = new Date(Date.now() - 10 * 60 * 1000);
    // Items 1–3 are in cooldown; items 4–8 are eligible.
    const map = new Map([
      [1, entry(recent)],
      [2, entry(recent)],
      [3, entry(recent)],
    ]);
    const items = [1, 2, 3, 4, 5, 6, 7, 8].map((id) => item(id, id * 10));
    const result = pickAutoSearchBatch(items, map, 3, "balanced", cooldown2h);
    expect(result).toHaveLength(3);
    result.forEach((r) => expect(r.id).toBeGreaterThan(3));
  });
});

// ─── pickAutoSearchBatch ────────────────────────────────────────────────────

describe("pickAutoSearchBatch", () => {
  const item = (id: number, cfScore: number) => ({ id, cfScore });
  const entry = (at: Date, failed = false) => ({ at, failed });
  // Score accessor — mirrors what `SCORE_FOR[mode]` returns at the
  // production call site. Tests that don't care about ordering omit it
  // and accept the default `() => 0` (everything ties, falls back to
  // insertion order).
  const scoreOf = (it: { cfScore: number }) => it.cfScore;

  test("empty items → []", () => {
    expect(pickAutoSearchBatch([], new Map(), 5)).toEqual([]);
  });

  test("batchLimit=0 → []", () => {
    expect(pickAutoSearchBatch([item(1, 0)], new Map(), 0)).toEqual([]);
  });

  test("all never-searched → sorted by cfScore asc (backfill), sliced to limit", () => {
    const items = [item(1, 10), item(2, 5), item(3, 1)];
    const result = pickAutoSearchBatch(
      items,
      new Map(),
      2,
      "balanced",
      0,
      scoreOf,
    );
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
    const result = pickAutoSearchBatch(
      items,
      new Map(),
      2,
      "balanced",
      0,
      scoreOf,
    );
    expect(result.map((i) => i.id)).toEqual([2, 1]);
  });

  // Regression for the profile-mode lossy-clamp bug. When `scoreOf`
  // returns a raw signed customFormatScore (as SCORE_FOR.profile does),
  // items with deep negative penalties must sort BEFORE items at the
  // baseline. Previously the picker read `item.cfScore` (clamped to
  // [0, 1] via scoreProfileCoverage) which collapsed all below-cutoff
  // items to 0, making catastrophic-penalty and just-below-cutoff
  // items indistinguishable in the worst-first sort.
  test("scoreOf with signed scores sorts negative-penalty items first (profile-mode regression)", () => {
    const items = [
      { id: 1, customFormatScore: 5 }, // slightly above zero
      { id: 2, customFormatScore: -200 }, // catastrophic penalty
      { id: 3, customFormatScore: 0 }, // baseline
      { id: 4, customFormatScore: -10 }, // mild penalty
    ];
    const result = pickAutoSearchBatch(
      items,
      new Map(),
      4,
      "balanced",
      0,
      (it) => it.customFormatScore,
    );
    // Worst (most negative) first → least bad → positive last.
    expect(result.map((i) => i.id)).toEqual([2, 4, 3, 1]);
  });

  test("missing-file sentinel (-Infinity) outranks every finite score", () => {
    // Callers in auto-runner wrap the per-mode SCORE_FOR accessor with a
    // sentinel: items with `existingFileCount === 0` resolve to -Infinity
    // so "no file at all" beats even the worst negative-penalty file.
    const items = [
      { id: 1, customFormatScore: -200, existingFileCount: 1 },
      { id: 2, customFormatScore: 4500, existingFileCount: 0 }, // no file
      { id: 3, customFormatScore: 0, existingFileCount: 0 }, // no file
      { id: 4, customFormatScore: 50, existingFileCount: 1 },
    ];
    const scoreOf = (it: (typeof items)[number]) =>
      it.existingFileCount === 0
        ? Number.NEGATIVE_INFINITY
        : it.customFormatScore;
    const result = pickAutoSearchBatch(
      items,
      new Map(),
      4,
      "balanced",
      0,
      scoreOf,
    );
    // Missing-file items (2, 3) first regardless of customFormatScore,
    // then negative-penalty (1), then mild positive (4).
    expect(
      result
        .map((i) => i.id)
        .slice(0, 2)
        .sort(),
    ).toEqual([2, 3]);
    expect(result.map((i) => i.id).slice(2)).toEqual([1, 4]);
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
    const result = pickAutoSearchBatch(items, map, 1, "balanced", 0, scoreOf);
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

// ─── pickAutoSearchMixedBatch — scope=mixed ────────────────────────────────

describe("categorizeForMixed", () => {
  test("no file → missing", () => {
    expect(
      categorizeForMixed({
        existingFileCount: 0,
        flagged: true,
        customFormatScore: 0,
      }),
    ).toBe("missing");
  });

  test("has file, negative score → flagged-penalty", () => {
    expect(
      categorizeForMixed({
        existingFileCount: 1,
        flagged: true,
        customFormatScore: -200,
      }),
    ).toBe("flagged-penalty");
  });

  test("has file, flagged, positive score → upgrade", () => {
    expect(
      categorizeForMixed({
        existingFileCount: 1,
        flagged: true,
        customFormatScore: 1250,
      }),
    ).toBe("upgrade");
  });

  test("has file, not flagged → null (clean — no bucket)", () => {
    expect(
      categorizeForMixed({
        existingFileCount: 1,
        flagged: false,
        customFormatScore: 5000,
      }),
    ).toBeNull();
  });

  test("has file, not flagged, negative score → null (clean items never enter mixed)", () => {
    // The `flagged` gate must come BEFORE the customFormatScore check
    // so a clean item with an incidentally-negative score doesn't fall
    // into "flagged-penalty". Locks down the mixed-scope contract:
    // mixed only ever picks items the user actually wants to act on.
    expect(
      categorizeForMixed({
        existingFileCount: 1,
        flagged: false,
        customFormatScore: -1,
      }),
    ).toBeNull();
  });
});

describe("allocateMixedQuota", () => {
  const ample = {
    missing: 100,
    "flagged-penalty": 100,
    upgrade: 100,
  } as const;

  test("batchLimit=5 with ample supply → 2 missing + 2 flagged + 1 upgrade", () => {
    expect(allocateMixedQuota(5, ample)).toEqual({
      missing: 2,
      "flagged-penalty": 2,
      upgrade: 1,
    });
  });

  test("batchLimit=6 with ample supply → 2 each (even split)", () => {
    expect(allocateMixedQuota(6, ample)).toEqual({
      missing: 2,
      "flagged-penalty": 2,
      upgrade: 2,
    });
  });

  test("batchLimit=2 with ample supply → 1 missing + 1 flagged + 0 upgrade (upgrade cycled out)", () => {
    expect(allocateMixedQuota(2, ample)).toEqual({
      missing: 1,
      "flagged-penalty": 1,
      upgrade: 0,
    });
  });

  test("batchLimit=0 → all zero", () => {
    expect(allocateMixedQuota(0, ample)).toEqual({
      missing: 0,
      "flagged-penalty": 0,
      upgrade: 0,
    });
  });

  test("missing underfilled → spill to flagged-penalty", () => {
    // batchLimit=6 wants 2 each; missing only has 1.
    // Overflow of 1 rolls forward to flagged-penalty.
    expect(
      allocateMixedQuota(6, {
        missing: 1,
        "flagged-penalty": 100,
        upgrade: 100,
      }),
    ).toEqual({ missing: 1, "flagged-penalty": 3, upgrade: 2 });
  });

  test("missing + flagged-penalty both empty → all spill to upgrade", () => {
    expect(
      allocateMixedQuota(6, {
        missing: 0,
        "flagged-penalty": 0,
        upgrade: 100,
      }),
    ).toEqual({ missing: 0, "flagged-penalty": 0, upgrade: 6 });
  });

  test("upgrade underfilled → no loop-back (slots are lost)", () => {
    expect(
      allocateMixedQuota(6, {
        missing: 100,
        "flagged-penalty": 100,
        upgrade: 0,
      }),
    ).toEqual({ missing: 2, "flagged-penalty": 2, upgrade: 0 });
  });
});

describe("pickAutoSearchMixedBatch", () => {
  const mk = (
    id: number,
    bucket: "missing" | "flagged-penalty" | "upgrade",
  ) => {
    if (bucket === "missing")
      return { id, existingFileCount: 0, flagged: true, customFormatScore: 0 };
    if (bucket === "flagged-penalty")
      return {
        id,
        existingFileCount: 1,
        flagged: true,
        customFormatScore: -100,
      };
    return {
      id,
      existingFileCount: 1,
      flagged: true,
      customFormatScore: 500,
    };
  };

  test("batchLimit=6 with ample supply → 2 from each bucket", () => {
    const items = [
      mk(1, "missing"),
      mk(2, "missing"),
      mk(3, "missing"),
      mk(4, "flagged-penalty"),
      mk(5, "flagged-penalty"),
      mk(6, "flagged-penalty"),
      mk(7, "upgrade"),
      mk(8, "upgrade"),
      mk(9, "upgrade"),
    ];
    const picked = pickAutoSearchMixedBatch(items, new Map(), 6, "balanced", 0);
    expect(picked).toHaveLength(6);
    const buckets = picked.map((p) => categorizeForMixed(p));
    expect(buckets.filter((b) => b === "missing")).toHaveLength(2);
    expect(buckets.filter((b) => b === "flagged-penalty")).toHaveLength(2);
    expect(buckets.filter((b) => b === "upgrade")).toHaveLength(2);
  });

  test("clean items (not flagged, has file) are excluded entirely", () => {
    const items = [
      mk(1, "missing"),
      { id: 2, existingFileCount: 1, flagged: false, customFormatScore: 9000 },
      { id: 3, existingFileCount: 1, flagged: false, customFormatScore: 5000 },
    ];
    const picked = pickAutoSearchMixedBatch(items, new Map(), 3, "balanced", 0);
    expect(picked.map((p) => p.id)).toEqual([1]);
  });

  test("empty bucket spills to next priority", () => {
    // No missing items; batchLimit=3 should give 1 flagged + 1 upgrade
    // (1+1 quota) + 1 spilled slot to flagged-penalty = 2 flagged + 1 upgrade.
    const items = [
      mk(1, "flagged-penalty"),
      mk(2, "flagged-penalty"),
      mk(3, "upgrade"),
    ];
    const picked = pickAutoSearchMixedBatch(items, new Map(), 3, "balanced", 0);
    expect(picked).toHaveLength(3);
    const buckets = picked.map((p) => categorizeForMixed(p));
    expect(buckets.filter((b) => b === "flagged-penalty")).toHaveLength(2);
    expect(buckets.filter((b) => b === "upgrade")).toHaveLength(1);
  });

  test("cooldown-filtered bucket spills its quota to next priority", () => {
    // 3 missing items all in cooldown; 3 flagged-penalty items eligible.
    // Without two-pass allocation, missing would steal 2 quota slots,
    // produce 0 items, and we'd end up with only 2 flagged picks
    // instead of using all of batchLimit=4.
    const recent = new Date(Date.now() - 30 * 60 * 1000);
    const items = [
      mk(1, "missing"),
      mk(2, "missing"),
      mk(3, "missing"),
      mk(4, "flagged-penalty"),
      mk(5, "flagged-penalty"),
      mk(6, "flagged-penalty"),
      mk(7, "upgrade"),
    ];
    const lastSearched = new Map([
      [1, { at: recent, failed: false }],
      [2, { at: recent, failed: false }],
      [3, { at: recent, failed: false }],
    ]);
    const cooldown2h = 2 * 60 * 60 * 1000;
    const picked = pickAutoSearchMixedBatch(
      items,
      lastSearched,
      4,
      "balanced",
      cooldown2h,
    );
    expect(picked).toHaveLength(4);
    expect(picked.every((p) => p.id >= 4)).toBe(true);
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
    await autoRunner.stop();
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

  test("successful runNow resets autoSearchFailedStreak to 0", async () => {
    mswServer.use(
      http.get(`${radarrBase}/api/v3/movie`, () => HttpResponse.json([])),
      ...radarrHandlers(
        { baseUrl: radarrBase },
        { movies: [], movieFiles: [], qualityProfiles: [] },
      ),
    );
    const inst = await instanceService.create({
      ...baseInstance,
      autoSearchScope: "all",
    });
    // Simulate prior failures.
    await instanceRepository.bumpFailedStreak(inst.id);
    await instanceRepository.bumpFailedStreak(inst.id);
    let row = await instanceRepository.findById(inst.id);
    expect(row?.autoSearchFailedStreak).toBe(2);

    await autoRunner.runNow(inst.id);

    row = await instanceRepository.findById(inst.id);
    expect(row?.autoSearchFailedStreak).toBe(0);
    await instanceService.delete(inst.id);
  });

  test("failing runNow bumps autoSearchFailedStreak by 1", async () => {
    // Upstream returns 500 → fanOut throws → runNow's catch bumps streak.
    // getMovies fetches /movie and /qualityprofile in parallel; the 500 on
    // /movie is what fails the run, but /qualityprofile still needs a
    // handler or it trips MSW's onUnhandledRequest guard.
    mswServer.use(
      http.get(`${radarrBase}/api/v3/movie`, () =>
        HttpResponse.json({ message: "boom" }, { status: 500 }),
      ),
      ...radarrHandlers(
        { baseUrl: radarrBase },
        { movies: [], movieFiles: [], qualityProfiles: [] },
      ),
    );
    const inst = await instanceService.create({
      ...baseInstance,
      autoSearchScope: "all",
    });

    await expect(autoRunner.runNow(inst.id)).rejects.toThrow();

    const row = await instanceRepository.findById(inst.id);
    expect(row?.autoSearchFailedStreak).toBe(1);
    await instanceService.delete(inst.id);
  });

  test("runNow does NOT bump streak when fanOut succeeds but bookkeeping fails", async () => {
    // fanOut succeeds against an empty upstream → 0 enqueues. Mock
    // stampLastRunAt to throw after that point. The bookkeeping rejection
    // must NOT cascade into a failed-streak bump — runNow should still
    // resolve and the streak should stay at its prior value.
    mswServer.use(
      http.get(`${radarrBase}/api/v3/movie`, () => HttpResponse.json([])),
      ...radarrHandlers(
        { baseUrl: radarrBase },
        { movies: [], movieFiles: [], qualityProfiles: [] },
      ),
    );
    const inst = await instanceService.create({
      ...baseInstance,
      autoSearchScope: "all",
    });
    // Pre-condition: streak starts at 0.
    let row = await instanceRepository.findById(inst.id);
    expect(row?.autoSearchFailedStreak).toBe(0);

    const stampSpy = vi
      .spyOn(instanceRepository, "stampLastRunAt")
      .mockRejectedValueOnce(new Error("transient DB"));
    try {
      await expect(autoRunner.runNow(inst.id)).resolves.toMatchObject({
        enqueued: 0,
      });
    } finally {
      stampSpy.mockRestore();
    }

    // Streak still 0 — the bookkeeping failure was logged + swallowed,
    // not attributed to fanOut.
    row = await instanceRepository.findById(inst.id);
    expect(row?.autoSearchFailedStreak).toBe(0);
    await instanceService.delete(inst.id);
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
      instance: inst,
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

// ─── buildAutoSearchStatus ──────────────────────────────────────────────────

describe("buildAutoSearchStatus", () => {
  const baseInst: Instance = {
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
    autoSearchEnabled: true,
    autoSearchScheduleMode: "interval",
    autoSearchIntervalMinutes: 60,
    autoSearchCronExpression: "0 3 * * *",
    autoSearchBatchLimit: 5,
    autoSearchLastRunAt: null,
    autoSearchMonitoredOnly: true,
    autoSearchScope: "flagged",
    autoSearchPickStrategy: "balanced",
    autoSearchCooldownHours: 0,
    autoSearchPausedUntil: null,
    autoSearchScoringMode: "inherit",
    autoSearchFailedStreak: 0,
  };

  test("disabled instance: enabled=false suppresses nextRunAt regardless of lastRunAt", () => {
    const lastRunAt = new Date(Date.now() - 30 * 60 * 1000);
    const status = buildAutoSearchStatus(
      { ...baseInst, autoSearchEnabled: false, autoSearchLastRunAt: lastRunAt },
      false,
    );
    expect(status.enabled).toBe(false);
    expect(status.nextRunAt).toBeNull();
  });

  test("interval mode: nextRunAt = lastRunAt + intervalMinutes (exact ms)", () => {
    // Use a recent lastRunAt so nextRunAt (lastRunAt + 120 min) is in the future.
    const lastRunAt = new Date(Date.now() - 30 * 60 * 1000);
    const status = buildAutoSearchStatus(
      {
        ...baseInst,
        autoSearchScheduleMode: "interval",
        autoSearchIntervalMinutes: 120,
        autoSearchLastRunAt: lastRunAt,
      },
      false,
    );
    const expected = lastRunAt.getTime() + 120 * 60 * 1000;
    expect(new Date(status.nextRunAt!).getTime()).toBe(expected);
  });

  test("interval mode + lastRunAt=null: nextRunAt is null (fires immediately, sentinel hidden)", () => {
    const status = buildAutoSearchStatus(
      { ...baseInst, autoSearchLastRunAt: null },
      false,
    );
    expect(status.nextRunAt).toBeNull();
  });

  test("running flag is passed through — true and false both work", () => {
    expect(buildAutoSearchStatus(baseInst, true).running).toBe(true);
    expect(buildAutoSearchStatus(baseInst, false).running).toBe(false);
  });

  test("no pause: paused=false, pausedUntil=null", () => {
    const status = buildAutoSearchStatus(
      { ...baseInst, autoSearchPausedUntil: null },
      false,
    );
    expect(status.paused).toBe(false);
    expect(status.pausedUntil).toBeNull();
  });

  test("pausedUntil in future: paused=true, pausedUntil matches the ISO timestamp", () => {
    const future = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const status = buildAutoSearchStatus(
      { ...baseInst, autoSearchPausedUntil: future },
      false,
    );
    expect(status.paused).toBe(true);
    expect(status.pausedUntil).toBe(future.toISOString());
  });

  test("pausedUntil expired (past): paused=false, pausedUntil=null — runner ignores expired pause", () => {
    const past = new Date(Date.now() - 60 * 1000);
    const status = buildAutoSearchStatus(
      { ...baseInst, autoSearchPausedUntil: past },
      false,
    );
    expect(status.paused).toBe(false);
    expect(status.pausedUntil).toBeNull();
  });

  test("6-field cron (seconds) → cronValid=false, nextRunAt=null (strict 5-field policy)", () => {
    const status = buildAutoSearchStatus(
      {
        ...baseInst,
        autoSearchScheduleMode: "cron",
        autoSearchCronExpression: "0 0 3 * * *",
      },
      false,
    );
    expect(status.cronValid).toBe(false);
    expect(status.nextRunAt).toBeNull();
  });

  test("garbage cron → cronValid=false, nextRunAt=null", () => {
    const status = buildAutoSearchStatus(
      {
        ...baseInst,
        autoSearchScheduleMode: "cron",
        autoSearchCronExpression: "not-a-cron",
      },
      false,
    );
    expect(status.cronValid).toBe(false);
    expect(status.nextRunAt).toBeNull();
  });

  test("valid cron: cronValid=true, nextRunAt is a future ISO timestamp", () => {
    const status = buildAutoSearchStatus(
      {
        ...baseInst,
        autoSearchScheduleMode: "cron",
        autoSearchCronExpression: "0 3 * * *",
      },
      false,
    );
    expect(status.cronValid).toBe(true);
    expect(new Date(status.nextRunAt!).getTime()).toBeGreaterThan(Date.now());
  });

  test("all instance fields are mapped to the correct output fields", () => {
    const future = new Date(Date.now() + 60 * 60 * 1000);
    const status = buildAutoSearchStatus(
      {
        ...baseInst,
        autoSearchBatchLimit: 10,
        autoSearchMonitoredOnly: false,
        autoSearchScope: "missing",
        autoSearchCooldownHours: 4,
        autoSearchScoringMode: "profile",
        autoSearchPausedUntil: future,
      },
      false,
    );
    expect(status.batchLimit).toBe(10);
    expect(status.monitoredOnly).toBe(false);
    expect(status.scope).toBe("missing");
    expect(status.cooldownHours).toBe(4);
    expect(status.scoringMode).toBe("profile");
    expect(status.paused).toBe(true);
  });

  test("overdue=false when nextRunAt is in the future", () => {
    const lastRun = new Date(Date.now() - 5 * 60 * 1000);
    const status = buildAutoSearchStatus(
      { ...baseInst, autoSearchLastRunAt: lastRun },
      false,
    );
    expect(status.overdue).toBe(false);
    expect(status.health).toBe("ok");
  });

  test("overdue=false when interval and lastRunAt is null (first run)", () => {
    // Freshly-enabled interval schedule: lastRunAt=null produces an
    // epoch-based rawNextRunAt that's already far in the past, but the
    // first tick hasn't had a chance to run yet — must not surface as a
    // warning before the runner gets a chance.
    const status = buildAutoSearchStatus(
      { ...baseInst, autoSearchLastRunAt: null },
      false,
    );
    expect(status.overdue).toBe(false);
    expect(status.health).toBe("ok");
  });

  test("overdue=true when interval next-run is past grace window", () => {
    // Interval=60min, lastRun=2h ago → nextRun computed 1h ago, well past
    // the 60s grace window.
    const lastRun = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const status = buildAutoSearchStatus(
      { ...baseInst, autoSearchLastRunAt: lastRun },
      false,
    );
    expect(status.overdue).toBe(true);
    expect(status.health).toBe("warning");
  });

  test("overdue=false while running, even if next-run is past", () => {
    const lastRun = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const status = buildAutoSearchStatus(
      { ...baseInst, autoSearchLastRunAt: lastRun },
      true,
    );
    expect(status.overdue).toBe(false);
  });

  test("overdue=false while paused, even if next-run is past", () => {
    const lastRun = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const pausedUntil = new Date(Date.now() + 60 * 60 * 1000);
    const status = buildAutoSearchStatus(
      {
        ...baseInst,
        autoSearchLastRunAt: lastRun,
        autoSearchPausedUntil: pausedUntil,
      },
      false,
    );
    expect(status.overdue).toBe(false);
  });

  test("failedStreak passes through; health=critical at threshold", () => {
    const status = buildAutoSearchStatus(
      { ...baseInst, autoSearchFailedStreak: 3 },
      false,
    );
    expect(status.failedStreak).toBe(3);
    expect(status.health).toBe("critical");
  });

  test("critical health overrides warning when both overdue and failedStreak hit", () => {
    const lastRun = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const status = buildAutoSearchStatus(
      {
        ...baseInst,
        autoSearchLastRunAt: lastRun,
        autoSearchFailedStreak: 5,
      },
      false,
    );
    expect(status.overdue).toBe(true);
    expect(status.health).toBe("critical");
  });

  test("failedStreak below threshold keeps health=ok when not overdue", () => {
    const status = buildAutoSearchStatus(
      {
        ...baseInst,
        autoSearchLastRunAt: new Date(),
        autoSearchFailedStreak: 2,
      },
      false,
    );
    expect(status.failedStreak).toBe(2);
    expect(status.health).toBe("ok");
  });
});
