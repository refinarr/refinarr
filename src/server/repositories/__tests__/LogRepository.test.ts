import { describe, test, expect, vi } from "vitest";
import { logRepository } from "@/server/repositories/LogRepository";
import type { ActionStatus, ActionType } from "@/shared/types/models";

const baseLog = {
  instanceId: 1,
  action: "search" as ActionType,
  mediaId: 100,
  title: "Movie 100",
  isDryRun: false,
  status: "success" as ActionStatus,
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
    await logRepository.create({ ...baseLog, status: "success" });
    await logRepository.create({ ...baseLog, status: "failed", error: "Boom" });
    await logRepository.create({ ...baseLog, instanceId: 2, status: "failed" });

    const failedInst1 = await logRepository.findPaginated({ instanceId: 1, status: "failed" }, 1, 50);
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
    await logRepository.create({ ...baseLog, status: "success" });
    await logRepository.create({ ...baseLog, status: "failed", error: "x" });
    await logRepository.create({ ...baseLog, instanceId: 2, status: "failed", error: "y" });
    const failed = await logRepository.findFailedByInstance(1);
    expect(failed).toHaveLength(1);
  });

  test("countByStatusSince counts rows matching status created on/after the cutoff", async () => {
    const before = new Date(Date.now() - 60_000);
    await logRepository.create({ ...baseLog, status: "failed" });
    await logRepository.create({ ...baseLog, status: "failed" });
    await logRepository.create({ ...baseLog, status: "success" });
    expect(await logRepository.countByStatusSince("failed", before)).toBe(2);
    expect(await logRepository.countByStatusSince("dry_run", before)).toBe(0);
  });

  test("findRecent caps the result at the limit", async () => {
    for (let i = 0; i < 4; i += 1) await logRepository.create({ ...baseLog, mediaId: i });
    const recent = await logRepository.findRecent(2);
    expect(recent).toHaveLength(2);
  });

  test("update mutates a row", async () => {
    const created = await logRepository.create(baseLog);
    const updated = await logRepository.update(created.id, { status: "failed" });
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
    await new Promise((r) => setTimeout(r, 50));
    const remaining = await logRepository.findAll();
    expect(remaining).toHaveLength(5);
    // Oldest two should be gone (mediaId 0, 1).
    expect(remaining.map((r) => r.mediaId).sort()).toEqual([2, 3, 4, 5, 6]);
  });

  describe("findRecentSearches", () => {
    test("returns the most recent successful search per mediaId within the window", async () => {
      await logRepository.create({ ...baseLog, mediaId: 1, title: "first hit" });
      await new Promise((r) => setTimeout(r, 5));
      const newer = await logRepository.create({ ...baseLog, mediaId: 1, title: "second hit (newer)" });
      await logRepository.create({ ...baseLog, mediaId: 2, title: "other media" });

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

    test("excludes failed and dry_run rows — only success counts as 'searched'", async () => {
      await logRepository.create({ ...baseLog, mediaId: 1, status: "failed", error: "boom" });
      await logRepository.create({ ...baseLog, mediaId: 2, status: "dry_run", isDryRun: true });
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
});
