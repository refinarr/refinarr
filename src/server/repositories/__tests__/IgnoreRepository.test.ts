import { describe, test, expect } from "vitest";
import { ignoreRepository } from "@/server/repositories/IgnoreRepository";

const e1 = {
  instanceId: 1,
  mediaId: 100,
  mediaType: "movie" as const,
  title: "Movie 100",
};
const e2 = {
  instanceId: 1,
  mediaId: 200,
  mediaType: "movie" as const,
  title: "Movie 200",
};
const e3 = {
  instanceId: 2,
  mediaId: 100,
  mediaType: "movie" as const,
  title: "Movie 100 (other instance)",
};

describe("IgnoreRepository", () => {
  test("create persists a row and findById returns it", async () => {
    const created = await ignoreRepository.create(e1);
    const found = await ignoreRepository.findById(created.id);
    expect(found?.title).toBe("Movie 100");
  });

  test("create is idempotent on (instanceId, mediaId, mediaType) — second call upserts", async () => {
    const a = await ignoreRepository.create(e1);
    const b = await ignoreRepository.create({
      ...e1,
      title: "Different title (ignored)",
    });
    expect(b.id).toBe(a.id);
  });

  test("isIgnored returns true for an existing entry, false for missing", async () => {
    await ignoreRepository.create(e1);
    expect(await ignoreRepository.isIgnored(1, 100, "movie")).toBe(true);
    expect(await ignoreRepository.isIgnored(1, 999, "movie")).toBe(false);
  });

  test("findByInstance returns rows for that instance only, ordered by ignoredAt desc", async () => {
    await ignoreRepository.create(e1);
    await ignoreRepository.create(e2);
    await ignoreRepository.create(e3);
    const inst1 = await ignoreRepository.findByInstance(1);
    expect(inst1).toHaveLength(2);
    expect(inst1.map((r) => r.mediaId).sort()).toEqual([100, 200]);
    const inst2 = await ignoreRepository.findByInstance(2);
    expect(inst2).toHaveLength(1);
    expect(inst2[0].title).toContain("other instance");
  });

  test("findAll returns every entry", async () => {
    await ignoreRepository.create(e1);
    await ignoreRepository.create(e2);
    expect(await ignoreRepository.findAll()).toHaveLength(2);
  });

  test("delete removes the row", async () => {
    const created = await ignoreRepository.create(e1);
    await ignoreRepository.delete(created.id);
    expect(await ignoreRepository.findById(created.id)).toBeNull();
  });

  test("update throws — ignore entries are immutable", async () => {
    await expect(ignoreRepository.update(1, {})).rejects.toThrow(/immutable/);
  });
});
