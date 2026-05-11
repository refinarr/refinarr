import { describe, test, expect, vi } from "vitest";
import { appLogger } from "@/server/lib/app-logger";
import { prisma } from "@/server/lib/db";
import { searchQueueRepository } from "@/server/repositories/SearchQueueRepository";

async function enqueue(
  instanceId: number,
  mediaId: number,
  action: "movie" | "series" | "season" | "episode" = "movie",
) {
  const { entry } = await searchQueueRepository.createUnique({
    instanceId,
    action,
    mediaId,
    title: `t-${mediaId}`,
    payload: "{}",
    seasonNumber: 0,
    fileId: 0,
  });
  return entry;
}

describe("SearchQueueRepository", () => {
  test("create + findById round-trip", async () => {
    const row = await enqueue(1, 100);
    const fetched = await searchQueueRepository.findById(row.id);
    expect(fetched?.id).toBe(row.id);
    expect(fetched?.status).toBe("pending");
  });

  test("plain create() inserts a row without dedup", async () => {
    // The non-deduping create() bypasses the partial unique index path —
    // used by callers that don't want createUnique's idempotency.
    const entry = await searchQueueRepository.create({
      instanceId: 1,
      action: "movie",
      mediaId: 200,
      title: "plain",
      payload: "{}",
      seasonNumber: 0,
      fileId: 0,
      status: "pending",
      error: null,
      processedAt: null,
      groupId: null,
    });
    expect(entry.id).toBeGreaterThan(0);
    expect(entry.title).toBe("plain");
    const fetched = await searchQueueRepository.findById(entry.id);
    expect(fetched?.title).toBe("plain");
  });

  test("createUnique swallows trim() rejections via appLogger.warn (defence in depth)", async () => {
    // The fire-and-forget trim() inside createUnique catches its own
    // rejection and warns instead of bubbling — so a hot insert path
    // never throws because retention bookkeeping hit a transient DB
    // error. Spy on prisma.searchQueue.count so trim() always rejects.
    const countSpy = vi
      .spyOn(prisma.searchQueue, "count")
      .mockRejectedValueOnce(new Error("DB unavailable"));
    const warnSpy = vi.spyOn(appLogger, "warn").mockImplementation(() => {});
    try {
      const { entry } = await searchQueueRepository.createUnique({
        instanceId: 1,
        action: "movie",
        mediaId: 500,
        title: "trim-fault",
        payload: "{}",
        seasonNumber: 0,
        fileId: 0,
      });
      expect(entry.id).toBeGreaterThan(0);
      // Allow the fire-and-forget catch to settle.
      await vi.waitFor(() => expect(warnSpy).toHaveBeenCalled(), {
        timeout: 200,
      });
      const [msg] = warnSpy.mock.calls[0];
      expect(msg).toMatch(/trim failed/i);
    } finally {
      countSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });

  test("createUnique re-throws errors that are not unique-constraint violations", async () => {
    // Foreign-key / not-null violations should bubble up — only P2002
    // (partial unique index) is special-cased into the dedup return.
    // Force a generic error by passing a non-string payload.
    await expect(
      searchQueueRepository.createUnique({
        instanceId: 1,
        action: "movie",
        mediaId: 1,
        title: "X",
        // @ts-expect-error — intentionally invalid to provoke a non-P2002 error.
        payload: 12345,
        seasonNumber: 0,
        fileId: 0,
      }),
    ).rejects.toThrow();
  });

  test("findNextPending returns the oldest pending row for the instance", async () => {
    const a = await enqueue(1, 1);
    await enqueue(2, 2); // different instance — should be ignored
    const b = await enqueue(1, 3);
    const next = await searchQueueRepository.findNextPending(1);
    expect(next?.id).toBe(a.id);
    // Mark a done; next should now be b.
    await searchQueueRepository.setStatus(a.id, "done");
    expect((await searchQueueRepository.findNextPending(1))?.id).toBe(b.id);
  });

  test("findNextPending returns null when no pending rows exist", async () => {
    expect(await searchQueueRepository.findNextPending(99)).toBeNull();
  });

  test("countPending only counts pending rows for this instance", async () => {
    await enqueue(1, 1);
    await enqueue(1, 2);
    const c = await enqueue(1, 3);
    await enqueue(2, 1);
    await searchQueueRepository.setStatus(c.id, "done");
    expect(await searchQueueRepository.countPending(1)).toBe(2);
    expect(await searchQueueRepository.countPending(2)).toBe(1);
  });

  test("setStatus stamps processedAt and stores the error", async () => {
    const row = await enqueue(1, 1);
    const updated = await searchQueueRepository.setStatus(
      row.id,
      "failed",
      "boom",
    );
    expect(updated.status).toBe("failed");
    expect(updated.error).toBe("boom");
    expect(updated.processedAt).not.toBeNull();
  });

  test("findPendingByInstance orders by createdAt ascending", async () => {
    const a = await enqueue(1, 1);
    const b = await enqueue(1, 2);
    const c = await enqueue(1, 3);
    const rows = await searchQueueRepository.findPendingByInstance(1);
    expect(rows.map((r) => r.id)).toEqual([a.id, b.id, c.id]);
  });

  test("findAllPending returns rows across instances, pending only", async () => {
    await enqueue(1, 1);
    await enqueue(2, 2);
    const c = await enqueue(2, 3);
    await searchQueueRepository.setStatus(c.id, "done");
    const rows = await searchQueueRepository.findAllPending();
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.status === "pending")).toBe(true);
  });

  test("findAll returns every row regardless of status", async () => {
    const a = await enqueue(1, 1);
    await enqueue(1, 2);
    await searchQueueRepository.setStatus(a.id, "done");
    const all = await searchQueueRepository.findAll();
    expect(all).toHaveLength(2);
  });

  test("update mutates arbitrary fields", async () => {
    const row = await enqueue(1, 1);
    const updated = await searchQueueRepository.update(row.id, {
      title: "renamed",
    });
    expect(updated.title).toBe("renamed");
  });

  test("delete removes a row by id", async () => {
    const row = await enqueue(1, 1);
    await searchQueueRepository.delete(row.id);
    expect(await searchQueueRepository.findById(row.id)).toBeNull();
  });

  test("trim deletes oldest terminal rows past the retention cap (cap=5 in tests)", async () => {
    // Enqueue then mark done so they are eligible for trim.
    for (let i = 0; i < 7; i += 1) {
      const row = await enqueue(1, i + 1);
      await searchQueueRepository.setStatus(row.id, "done");
      await new Promise((r) => setTimeout(r, 2));
    }
    // The next create() call triggers trim() — pending rows are exempt.
    await enqueue(1, 100);
    await vi.waitFor(
      async () => {
        const all = await searchQueueRepository.findAll();
        const terminal = all.filter((r) => r.status !== "pending");
        expect(terminal.length).toBeLessThanOrEqual(5);
      },
      { timeout: 500 },
    );
  });

  test("findLastProcessedAt returns null when no terminal rows exist", async () => {
    await enqueue(1, 1); // pending only
    expect(await searchQueueRepository.findLastProcessedAt(1)).toBeNull();
  });

  test("findLastProcessedAt returns the most recent processedAt across done/failed rows", async () => {
    const a = await enqueue(1, 1);
    await searchQueueRepository.setStatus(a.id, "done");
    await new Promise((r) => setTimeout(r, 5));
    const b = await enqueue(1, 2);
    await searchQueueRepository.setStatus(b.id, "failed", "err");
    await enqueue(1, 3); // still pending — should not affect result
    await enqueue(2, 1); // different instance — should not affect result
    const ts = await searchQueueRepository.findLastProcessedAt(1);
    expect(ts).not.toBeNull();
    const bRow = await searchQueueRepository.findById(b.id);
    expect(ts!.getTime()).toBe(new Date(bRow!.processedAt!).getTime());
  });

  test("createUnique returns existing pending row when unique index conflicts (movie)", async () => {
    const { entry: first, created: c1 } =
      await searchQueueRepository.createUnique({
        instanceId: 1,
        action: "movie",
        mediaId: 42,
        title: "X",
        payload: "{}",
        seasonNumber: 0,
        fileId: 0,
      });
    const { entry: second, created: c2 } =
      await searchQueueRepository.createUnique({
        instanceId: 1,
        action: "movie",
        mediaId: 42,
        title: "X",
        payload: "{}",
        seasonNumber: 0,
        fileId: 0,
      });
    expect(c1).toBe(true);
    expect(c2).toBe(false);
    expect(second.id).toBe(first.id);
    expect(await searchQueueRepository.countPending(1)).toBe(1);
  });

  test("createUnique returns existing pending row for the same season", async () => {
    const { entry: first } = await searchQueueRepository.createUnique({
      instanceId: 1,
      action: "season",
      mediaId: 7,
      title: "S",
      payload: "{}",
      seasonNumber: 2,
      fileId: 0,
    });
    const { entry: second, created } = await searchQueueRepository.createUnique(
      {
        instanceId: 1,
        action: "season",
        mediaId: 7,
        title: "S",
        payload: "{}",
        seasonNumber: 2,
        fileId: 0,
      },
    );
    expect(created).toBe(false);
    expect(second.id).toBe(first.id);
  });

  test("createUnique allows different seasons for the same series", async () => {
    const { entry: s1 } = await searchQueueRepository.createUnique({
      instanceId: 1,
      action: "season",
      mediaId: 7,
      title: "S1",
      payload: "{}",
      seasonNumber: 1,
      fileId: 0,
    });
    const { entry: s2 } = await searchQueueRepository.createUnique({
      instanceId: 1,
      action: "season",
      mediaId: 7,
      title: "S2",
      payload: "{}",
      seasonNumber: 2,
      fileId: 0,
    });
    expect(s1.id).not.toBe(s2.id);
    expect(await searchQueueRepository.countPending(1)).toBe(2);
  });

  test("re-enqueue after done creates a fresh row", async () => {
    const { entry: first } = await searchQueueRepository.createUnique({
      instanceId: 1,
      action: "movie",
      mediaId: 99,
      title: "M",
      payload: "{}",
      seasonNumber: 0,
      fileId: 0,
    });
    await searchQueueRepository.setStatus(first.id, "done");
    // Done row is outside the partial index scope — new pending row is allowed.
    const { entry: second, created } = await searchQueueRepository.createUnique(
      {
        instanceId: 1,
        action: "movie",
        mediaId: 99,
        title: "M",
        payload: "{}",
        seasonNumber: 0,
        fileId: 0,
      },
    );
    expect(created).toBe(true);
    expect(second.id).not.toBe(first.id);
    expect(second.status).toBe("pending");
  });

  test("deletePendingByInstance removes only pending rows for the given instance", async () => {
    await enqueue(1, 1);
    await enqueue(1, 2);
    const c = await enqueue(1, 3);
    await searchQueueRepository.setStatus(c.id, "done");
    await enqueue(2, 1);
    const removed = await searchQueueRepository.deletePendingByInstance(1);
    expect(removed).toBe(2);
    expect(await searchQueueRepository.countPending(1)).toBe(0);
    expect(await searchQueueRepository.countPending(2)).toBe(1);
    // Terminal row for instance 1 stays put.
    expect(await searchQueueRepository.findById(c.id)).not.toBeNull();
  });
});
