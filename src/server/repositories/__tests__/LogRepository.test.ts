import { describe, test, expect, vi } from "vitest";
import { logRepository } from "@/server/repositories/LogRepository";
import type { ActionStatus, ActionType } from "@/shared/types/models";

const baseLog = {
  instanceId: 1,
  action: "search" as ActionType,
  mediaId: 100,
  title: "Movie 100",
  isDryRun: false,
  status: "searched" as ActionStatus,
  error: null,
  payload: null,
};

describe("LogRepository", () => {
  test("create + findById round-trips", async () => {
    const created = await logRepository.create(baseLog);
    const found = await logRepository.findById(created.id);
    expect(found?.title).toBe("Movie 100");
  });

  test("findAll returns rows in createdAt desc order", async () => {
    await logRepository.create({ ...baseLog, title: "First" });
    // Force a tick so createdAt differs
    await new Promise((r) => setTimeout(r, 5));
    await logRepository.create({ ...baseLog, title: "Second" });
    const all = await logRepository.findAll();
    expect(all[0].title).toBe("Second");
    expect(all[1].title).toBe("First");
  });

  test("findPaginated applies status + action + instanceId filters", async () => {
    await logRepository.create({ ...baseLog, status: "searched" });
    await logRepository.create({ ...baseLog, status: "failed", error: "Boom" });
    await logRepository.create({ ...baseLog, instanceId: 2, status: "failed" });

    const failedInst1 = await logRepository.findPaginated(
      { instanceId: 1, status: "failed" },
      1,
      50,
    );
    expect(failedInst1.total).toBe(1);
    expect(failedInst1.items[0].error).toBe("Boom");
  });

  test("findPaginated paginates correctly", async () => {
    for (let i = 0; i < 5; i += 1) {
      await logRepository.create({ ...baseLog, mediaId: i });
    }
    const page1 = await logRepository.findPaginated({}, 1, 2);
    const page2 = await logRepository.findPaginated({}, 2, 2);
    expect(page1.items).toHaveLength(2);
    expect(page2.items).toHaveLength(2);
    expect(page1.total).toBe(5);
  });

  test("findFailedByInstance returns only failed rows for the instance", async () => {
    await logRepository.create({ ...baseLog, status: "searched" });
    await logRepository.create({ ...baseLog, status: "failed", error: "x" });
    await logRepository.create({
      ...baseLog,
      instanceId: 2,
      status: "failed",
      error: "y",
    });
    const failed = await logRepository.findFailedByInstance(1);
    expect(failed).toHaveLength(1);
  });

  test("countByStatusSince counts rows matching status created on/after the cutoff", async () => {
    const before = new Date(Date.now() - 60_000);
    await logRepository.create({ ...baseLog, status: "failed" });
    await logRepository.create({ ...baseLog, status: "failed" });
    await logRepository.create({ ...baseLog, status: "searched" });
    expect(await logRepository.countByStatusSince("failed", before)).toBe(2);
    expect(await logRepository.countByStatusSince("dry_run", before)).toBe(0);
  });

  test("findRecent caps the result at the limit", async () => {
    for (let i = 0; i < 4; i += 1)
      await logRepository.create({ ...baseLog, mediaId: i });
    const recent = await logRepository.findRecent(2);
    expect(recent).toHaveLength(2);
  });

  test("update mutates a row", async () => {
    const created = await logRepository.create(baseLog);
    const updated = await logRepository.update(created.id, {
      status: "failed",
    });
    expect(updated.status).toBe("failed");
  });

  test("delete removes the row", async () => {
    const created = await logRepository.create(baseLog);
    await logRepository.delete(created.id);
    expect(await logRepository.findById(created.id)).toBeNull();
  });

  test("clearAll empties the table", async () => {
    await logRepository.create(baseLog);
    await logRepository.create(baseLog);
    await logRepository.clearAll();
    expect(await logRepository.findAll()).toHaveLength(0);
  });

  test("trim deletes oldest rows when retention cap is exceeded (cap=5 in tests)", async () => {
    for (let i = 0; i < 7; i += 1) {
      await logRepository.create({ ...baseLog, mediaId: i, title: `m${i}` });
      await new Promise((r) => setTimeout(r, 2));
    }
    await vi.waitFor(
      async () => {
        const remaining = await logRepository.findAll();
        expect(remaining).toHaveLength(5);
      },
      { timeout: 500 },
    );
    const remaining = await logRepository.findAll();
    // Oldest two should be gone (mediaId 0, 1).
    expect(remaining.map((r) => r.mediaId).sort()).toEqual([2, 3, 4, 5, 6]);
  });

  describe("findRecentSearches", () => {
    test("returns the most recent successful search per mediaId within the window", async () => {
      await logRepository.create({
        ...baseLog,
        mediaId: 1,
        title: "first hit",
      });
      await new Promise((r) => setTimeout(r, 5));
      const newer = await logRepository.create({
        ...baseLog,
        mediaId: 1,
        title: "second hit (newer)",
      });
      await logRepository.create({
        ...baseLog,
        mediaId: 2,
        title: "other media",
      });

      const results = await logRepository.findRecentSearches(1, 60_000);
      expect(results).toHaveLength(2);
      const idMap = new Map(results.map((r) => [r.mediaId, r.lastSearchedAt]));
      // Two successful rows for mediaId=1 — must collapse to the latest timestamp.
      expect(idMap.has(1)).toBe(true);
      expect(idMap.get(1)!.getTime()).toBe(new Date(newer.createdAt).getTime());
      expect(idMap.has(2)).toBe(true);
    });

    test("excludes rows older than the window", async () => {
      vi.useFakeTimers({ now: Date.now() - 100 });
      try {
        await logRepository.create({ ...baseLog, mediaId: 1 });
      } finally {
        vi.useRealTimers();
      }
      const results = await logRepository.findRecentSearches(1, 1);
      expect(results).toHaveLength(0);
    });

    test("excludes failed and isDryRun rows — only non-dry post-dispatch rows count", async () => {
      await logRepository.create({
        ...baseLog,
        mediaId: 1,
        status: "failed",
        error: "boom",
      });
      await logRepository.create({
        ...baseLog,
        mediaId: 2,
        status: "searched",
        isDryRun: true,
      });
      const results = await logRepository.findRecentSearches(1, 60_000);
      expect(results).toHaveLength(0);
    });

    test("scopes to the given instance", async () => {
      await logRepository.create({ ...baseLog, instanceId: 1, mediaId: 1 });
      await logRepository.create({ ...baseLog, instanceId: 2, mediaId: 1 });
      expect(await logRepository.findRecentSearches(1, 60_000)).toHaveLength(1);
      expect(await logRepository.findRecentSearches(2, 60_000)).toHaveLength(1);
      expect(await logRepository.findRecentSearches(3, 60_000)).toHaveLength(0);
    });
  });

  // === statusPoller correlation queries ============================
  describe("findOpenCommandsByInstance — command-sync target rows", () => {
    test("returns rows with non-null commandId at searched/grabbed within the window", async () => {
      const a = await logRepository.create({
        ...baseLog,
        commandId: 7777,
        status: "searched",
      });
      const b = await logRepository.create({
        ...baseLog,
        mediaId: 101,
        commandId: 7778,
        status: "grabbed",
      });
      // Excluded: no commandId.
      await logRepository.create({
        ...baseLog,
        mediaId: 102,
        status: "searched",
      });
      // Excluded: terminal status.
      await logRepository.create({
        ...baseLog,
        mediaId: 103,
        commandId: 7779,
        status: "downloaded",
      });
      await logRepository.create({
        ...baseLog,
        mediaId: 104,
        commandId: 7780,
        status: "failed",
        error: "x",
      });

      const open = await logRepository.findOpenCommandsByInstance(1, 60_000);
      const ids = open.map((r) => r.id).sort();
      expect(ids).toEqual([a.id, b.id].sort());
    });

    test("excludes rows older than the window (memory bound for long-running instances)", async () => {
      vi.useFakeTimers({ now: Date.now() - 10_000 });
      try {
        await logRepository.create({
          ...baseLog,
          commandId: 7777,
          status: "searched",
        });
      } finally {
        vi.useRealTimers();
      }
      const open = await logRepository.findOpenCommandsByInstance(1, 1_000);
      expect(open).toHaveLength(0);
    });

    test("scopes to the given instance (no cross-instance leak)", async () => {
      await logRepository.create({
        ...baseLog,
        instanceId: 1,
        commandId: 7777,
        status: "searched",
      });
      await logRepository.create({
        ...baseLog,
        instanceId: 2,
        commandId: 7777,
        status: "searched",
      });
      expect(
        (await logRepository.findOpenCommandsByInstance(1, 60_000)).map(
          (r) => r.instanceId,
        ),
      ).toEqual([1]);
    });
  });

  describe("findCorrelatableByMedia — history-sync fuzzy match", () => {
    test("returns the most recent matching row by createdAt", async () => {
      await logRepository.create({
        ...baseLog,
        mediaId: 42,
        status: "searched",
      });
      await new Promise((r) => setTimeout(r, 5));
      const newer = await logRepository.create({
        ...baseLog,
        mediaId: 42,
        status: "searched",
      });
      const found = await logRepository.findCorrelatableByMedia({
        instanceId: 1,
        mediaId: 42,
        actions: ["search"],
        statusFloor: ["searched", "grabbed"],
        sinceMs: 60_000,
      });
      expect(found?.id).toBe(newer.id);
    });

    test("respects status floor — won't match a downloaded row", async () => {
      await logRepository.create({
        ...baseLog,
        mediaId: 42,
        status: "downloaded",
      });
      const found = await logRepository.findCorrelatableByMedia({
        instanceId: 1,
        mediaId: 42,
        actions: ["search"],
        statusFloor: ["searched", "grabbed"],
        sinceMs: 60_000,
      });
      expect(found).toBeNull();
    });

    test("respects action filter — episode events don't match series rows", async () => {
      await logRepository.create({
        ...baseLog,
        mediaId: 42,
        action: "search",
      });
      const found = await logRepository.findCorrelatableByMedia({
        instanceId: 1,
        mediaId: 42,
        actions: ["search_episode"],
        statusFloor: ["searched", "grabbed"],
        sinceMs: 60_000,
      });
      expect(found).toBeNull();
    });

    test("excludes dry-run rows (real history events shouldn't touch previews)", async () => {
      await logRepository.create({
        ...baseLog,
        mediaId: 42,
        status: "dry_run",
        isDryRun: true,
      });
      const found = await logRepository.findCorrelatableByMedia({
        instanceId: 1,
        mediaId: 42,
        actions: ["search"],
        statusFloor: ["searched", "grabbed", "dry_run"],
        sinceMs: 60_000,
      });
      expect(found).toBeNull();
    });

    test("scopes to the given instance", async () => {
      await logRepository.create({
        ...baseLog,
        instanceId: 1,
        mediaId: 42,
      });
      await logRepository.create({
        ...baseLog,
        instanceId: 2,
        mediaId: 42,
      });
      const found1 = await logRepository.findCorrelatableByMedia({
        instanceId: 1,
        mediaId: 42,
        actions: ["search"],
        statusFloor: ["searched", "grabbed"],
        sinceMs: 60_000,
      });
      const found2 = await logRepository.findCorrelatableByMedia({
        instanceId: 2,
        mediaId: 42,
        actions: ["search"],
        statusFloor: ["searched", "grabbed"],
        sinceMs: 60_000,
      });
      expect(found1?.instanceId).toBe(1);
      expect(found2?.instanceId).toBe(2);
    });
  });

  describe("findLastSearchedAtByMedia", () => {
    test("returns empty map when no search actions exist", async () => {
      const result = await logRepository.findLastSearchedAtByMedia(1);
      expect(result.size).toBe(0);
    });

    test("returns max createdAt per mediaId for search actions", async () => {
      // Two search entries for mediaId=10; one older, one newer.
      const older = await logRepository.create({
        ...baseLog,
        mediaId: 10,
        action: "search",
      });
      await new Promise((r) => setTimeout(r, 5));
      const newer = await logRepository.create({
        ...baseLog,
        mediaId: 10,
        action: "search",
      });

      const result = await logRepository.findLastSearchedAtByMedia(1);
      const entry = result.get(10)!;
      expect(entry).toBeDefined();
      // Should be the newer row's createdAt, not the older one.
      expect(entry.at.getTime()).toBeGreaterThanOrEqual(
        newer.createdAt.getTime(),
      );
      expect(entry.at.getTime()).toBeGreaterThan(older.createdAt.getTime());
    });

    test("scoped to instanceId — other instances excluded", async () => {
      await logRepository.create({
        ...baseLog,
        instanceId: 1,
        mediaId: 1,
        action: "search",
      });
      await logRepository.create({
        ...baseLog,
        instanceId: 2,
        mediaId: 2,
        action: "search",
      });

      const result1 = await logRepository.findLastSearchedAtByMedia(1);
      expect(result1.has(1)).toBe(true);
      expect(result1.has(2)).toBe(false);

      const result2 = await logRepository.findLastSearchedAtByMedia(2);
      expect(result2.has(2)).toBe(true);
      expect(result2.has(1)).toBe(false);
    });

    test("failed flag: most recent row failed → entry.failed=true", async () => {
      await logRepository.create({
        ...baseLog,
        mediaId: 7,
        action: "search",
        status: "searched",
      });
      await new Promise((r) => setTimeout(r, 5));
      await logRepository.create({
        ...baseLog,
        mediaId: 7,
        action: "search",
        status: "failed",
        error: "no results",
      });

      const result = await logRepository.findLastSearchedAtByMedia(1);
      const entry = result.get(7)!;
      expect(entry).toBeDefined();
      expect(entry.failed).toBe(true);
    });

    test("failed flag: most recent row succeeded → entry.failed=false", async () => {
      await logRepository.create({
        ...baseLog,
        mediaId: 8,
        action: "search",
        status: "failed",
        error: "old failure",
      });
      await new Promise((r) => setTimeout(r, 5));
      await logRepository.create({
        ...baseLog,
        mediaId: 8,
        action: "search",
        status: "searched",
      });

      const result = await logRepository.findLastSearchedAtByMedia(1);
      const entry = result.get(8)!;
      expect(entry).toBeDefined();
      expect(entry.failed).toBe(false);
    });

    test("non-search actions are excluded", async () => {
      await logRepository.create({ ...baseLog, mediaId: 5, action: "delete" });
      await logRepository.create({ ...baseLog, mediaId: 5, action: "ignore" });

      const result = await logRepository.findLastSearchedAtByMedia(1);
      expect(result.has(5)).toBe(false);
    });

    test("multiple mediaIds each get their own max timestamp", async () => {
      await logRepository.create({ ...baseLog, mediaId: 1, action: "search" });
      await new Promise((r) => setTimeout(r, 5));
      await logRepository.create({ ...baseLog, mediaId: 2, action: "search" });

      const result = await logRepository.findLastSearchedAtByMedia(1);
      expect(result.size).toBe(2);
      expect(result.get(1)!.at.getTime()).toBeLessThan(
        result.get(2)!.at.getTime(),
      );
    });
  });
});
