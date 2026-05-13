import { describe, test, expect } from "vitest";
import { appLogRepository } from "@/server/repositories/AppLogRepository";
import { prisma } from "@/server/lib/db";

const baseEntry = {
  level: "info" as const,
  message: "hello",
  source: "test",
  context: null,
};

describe("AppLogRepository", () => {
  test("create + findById round-trips", async () => {
    const created = await appLogRepository.create(baseEntry);
    const found = await appLogRepository.findById(created.id);
    expect(found?.message).toBe("hello");
  });

  test("findAll orders rows by createdAt desc", async () => {
    await appLogRepository.create({ ...baseEntry, message: "first" });
    await new Promise((r) => setTimeout(r, 5));
    await appLogRepository.create({ ...baseEntry, message: "second" });
    const all = await appLogRepository.findAll();
    expect(all[0].message).toBe("second");
  });

  test("findPaginated applies level filter", async () => {
    await appLogRepository.create({ ...baseEntry, level: "info" });
    await appLogRepository.create({ ...baseEntry, level: "error" });
    const errors = await appLogRepository.findPaginated(
      { level: "error" },
      1,
      50,
    );
    expect(errors.total).toBe(1);
    expect(errors.items[0].level).toBe("error");
  });

  test("findPaginated applies q substring filter on message", async () => {
    await appLogRepository.create({ ...baseEntry, message: "needle in here" });
    await appLogRepository.create({ ...baseEntry, message: "unrelated" });
    const matches = await appLogRepository.findPaginated(
      { q: "needle" },
      1,
      50,
    );
    expect(matches.total).toBe(1);
  });

  test("findSince returns rows with id > lastId, capped at 200", async () => {
    const a = await appLogRepository.create({ ...baseEntry, message: "a" });
    await appLogRepository.create({ ...baseEntry, message: "b" });
    await appLogRepository.create({ ...baseEntry, message: "c" });
    const after = await appLogRepository.findSince(a.id);
    expect(after.map((r) => r.message)).toEqual(["b", "c"]);
  });

  test("findSince accepts level filter", async () => {
    await appLogRepository.create({
      ...baseEntry,
      level: "info",
      message: "i",
    });
    const e = await appLogRepository.create({
      ...baseEntry,
      level: "error",
      message: "e",
    });
    const after = await appLogRepository.findSince(0, { level: "error" });
    expect(after.map((r) => r.id)).toEqual([e.id]);
  });

  test("findSince accepts source filter", async () => {
    await appLogRepository.create({ ...baseEntry, source: "api" });
    const db = await appLogRepository.create({ ...baseEntry, source: "db" });
    const after = await appLogRepository.findSince(0, { source: "db" });
    expect(after.map((r) => r.id)).toEqual([db.id]);
  });

  test("findSince accepts q substring filter on message", async () => {
    await appLogRepository.create({ ...baseEntry, message: "irrelevant" });
    const hit = await appLogRepository.create({
      ...baseEntry,
      message: "needle here",
    });
    const after = await appLogRepository.findSince(0, { q: "needle" });
    expect(after.map((r) => r.id)).toEqual([hit.id]);
  });

  test("findLatest returns up to limit rows in chronological order", async () => {
    for (let i = 0; i < 5; i += 1) {
      await appLogRepository.create({ ...baseEntry, message: `m${i}` });
    }
    const latest = await appLogRepository.findLatest(3);
    expect(latest).toHaveLength(3);
    // Reversed from desc → chronological asc.
    expect(latest[0].message).toBe("m2");
    expect(latest[2].message).toBe("m4");
  });

  test("findLatest accepts level filter", async () => {
    await appLogRepository.create({ ...baseEntry, level: "info" });
    await appLogRepository.create({ ...baseEntry, level: "error" });
    const latest = await appLogRepository.findLatest(50, { level: "error" });
    expect(latest).toHaveLength(1);
    expect(latest[0].level).toBe("error");
  });

  test("findLatest accepts source filter", async () => {
    await appLogRepository.create({ ...baseEntry, source: "api" });
    await appLogRepository.create({ ...baseEntry, source: "db" });
    const latest = await appLogRepository.findLatest(50, { source: "db" });
    expect(latest).toHaveLength(1);
    expect(latest[0].source).toBe("db");
  });

  test("findLatest accepts q substring filter on message", async () => {
    await appLogRepository.create({ ...baseEntry, message: "unrelated" });
    await appLogRepository.create({ ...baseEntry, message: "find me" });
    const latest = await appLogRepository.findLatest(50, { q: "find" });
    expect(latest).toHaveLength(1);
    expect(latest[0].message).toBe("find me");
  });

  test("create persists the lifted instanceId column", async () => {
    const row = await appLogRepository.create({ ...baseEntry, instanceId: 7 });
    expect(row.instanceId).toBe(7);
    const found = await appLogRepository.findById(row.id);
    expect(found?.instanceId).toBe(7);
  });

  test("findPaginated filters by instanceId", async () => {
    await appLogRepository.create({ ...baseEntry, instanceId: 1 });
    await appLogRepository.create({ ...baseEntry, instanceId: 2 });
    await appLogRepository.create({ ...baseEntry, instanceId: null });
    const onlyOne = await appLogRepository.findPaginated(
      { instanceId: 1 },
      1,
      50,
    );
    expect(onlyOne.total).toBe(1);
    expect(onlyOne.items[0].instanceId).toBe(1);
  });

  test("findSince + findLatest accept instanceId filter", async () => {
    const a = await appLogRepository.create({
      ...baseEntry,
      instanceId: 1,
      message: "i1",
    });
    await appLogRepository.create({
      ...baseEntry,
      instanceId: 2,
      message: "i2",
    });

    const since = await appLogRepository.findSince(0, { instanceId: 1 });
    expect(since.map((r) => r.id)).toEqual([a.id]);

    const latest = await appLogRepository.findLatest(50, { instanceId: 1 });
    expect(latest.map((r) => r.id)).toEqual([a.id]);
  });

  test("delete removes the row", async () => {
    const created = await appLogRepository.create(baseEntry);
    await appLogRepository.delete(created.id);
    expect(await appLogRepository.findById(created.id)).toBeNull();
  });

  test("clearAll empties the table", async () => {
    await appLogRepository.create(baseEntry);
    await appLogRepository.clearAll();
    expect(await appLogRepository.findAll()).toHaveLength(0);
  });

  test("update throws — entries are immutable", async () => {
    await expect(appLogRepository.update(1, {})).rejects.toThrow(/immutable/);
  });

  test("trim is a no-op below the retention cap", async () => {
    // RETENTION_CAP = 5000 — so 3 rows is far below. Just verifies create returns and trim doesn't crash.
    await appLogRepository.create(baseEntry);
    expect(await prisma.appLog.count()).toBe(1);
  });

  test("trim deletes oldest rows when retention cap is exceeded (cap=5 in tests)", async () => {
    // global-setup sets LOG_RETENTION_CAP=5; create 7 rows so trim should drop 2.
    for (let i = 0; i < 7; i += 1) {
      await appLogRepository.create({ ...baseEntry, message: `m${i}` });
      // Tiny pause so createdAt ordering is deterministic.
      await new Promise((r) => setTimeout(r, 2));
    }
    // trim runs as fire-and-forget — let it settle.
    await new Promise((r) => setTimeout(r, 50));
    const remaining = await appLogRepository.findAll();
    expect(remaining).toHaveLength(5);
    // Oldest two ("m0", "m1") should be gone.
    expect(remaining.map((r) => r.message).sort()).toEqual([
      "m2",
      "m3",
      "m4",
      "m5",
      "m6",
    ]);
  });
});
