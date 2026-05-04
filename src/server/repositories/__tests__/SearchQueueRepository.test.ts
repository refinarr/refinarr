import { describe, test, expect } from "vitest";
import { searchQueueRepository } from "@/server/repositories/SearchQueueRepository";

async function enqueue(instanceId: number, mediaId: number, action: "movie" | "series" | "season" | "episode-file" = "movie") {
  return searchQueueRepository.create({
    instanceId,
    action,
    mediaId,
    title: `t-${mediaId}`,
    payload: "{}",
  });
}

describe("SearchQueueRepository", () => {
  test("create + findById round-trip", async () => {
    const row = await enqueue(1, 100);
    const fetched = await searchQueueRepository.findById(row.id);
    expect(fetched?.id).toBe(row.id);
    expect(fetched?.status).toBe("pending");
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
    const updated = await searchQueueRepository.setStatus(row.id, "failed", "boom");
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
    const updated = await searchQueueRepository.update(row.id, { title: "renamed" });
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
    const all = await searchQueueRepository.findAll();
    const terminal = all.filter((r) => r.status !== "pending");
    expect(terminal.length).toBeLessThanOrEqual(5);
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
