import { describe, test, expect } from "vitest";
import { instanceRepository } from "@/server/repositories/InstanceRepository";
import { isEncrypted } from "@/server/lib/crypto";
import { prisma } from "@/server/lib/db";

const baseData = {
  type: "radarr" as const,
  name: "Test Radarr",
  url: "http://192.168.1.10:7878",
  apiKey: "abcd1234abcd1234abcd1234abcd1234",
  enabled: true,
};

describe("InstanceRepository.create", () => {
  test("encrypts apiKey at rest and returns the decrypted form", async () => {
    const created = await instanceRepository.create(baseData);
    expect(created.apiKey).toBe(baseData.apiKey);
    const raw = await prisma.instance.findUnique({ where: { id: created.id } });
    expect(isEncrypted(raw!.apiKey)).toBe(true);
    expect(raw!.apiKey).not.toBe(baseData.apiKey);
  });
});

describe("InstanceRepository.findById / findAll / findAllEnabled", () => {
  test("findById decrypts apiKey", async () => {
    const created = await instanceRepository.create(baseData);
    const found = await instanceRepository.findById(created.id);
    expect(found?.apiKey).toBe(baseData.apiKey);
  });

  test("findById returns null for missing id", async () => {
    expect(await instanceRepository.findById(99999)).toBeNull();
  });

  test("findAll returns rows in createdAt order with decrypted keys", async () => {
    await instanceRepository.create({ ...baseData, name: "A" });
    await instanceRepository.create({ ...baseData, name: "B" });
    const all = await instanceRepository.findAll();
    expect(all.map((i) => i.name)).toEqual(["A", "B"]);
    expect(all.every((i) => i.apiKey === baseData.apiKey)).toBe(true);
  });

  test("findAllEnabled excludes disabled instances", async () => {
    await instanceRepository.create({ ...baseData, name: "ON", enabled: true });
    await instanceRepository.create({
      ...baseData,
      name: "OFF",
      enabled: false,
    });
    const enabled = await instanceRepository.findAllEnabled();
    expect(enabled.map((i) => i.name)).toEqual(["ON"]);
  });
});

describe("InstanceRepository.update", () => {
  test("re-encrypts apiKey when changed", async () => {
    const created = await instanceRepository.create(baseData);
    const updated = await instanceRepository.update(created.id, {
      apiKey: "newkeynewkeynewkeynewkeynewkey00",
    });
    expect(updated.apiKey).toBe("newkeynewkeynewkeynewkeynewkey00");
    const raw = await prisma.instance.findUnique({ where: { id: created.id } });
    expect(isEncrypted(raw!.apiKey)).toBe(true);
  });

  test("leaves apiKey untouched when not in the update payload", async () => {
    const created = await instanceRepository.create(baseData);
    const before = (await prisma.instance.findUnique({
      where: { id: created.id },
    }))!.apiKey;
    await instanceRepository.update(created.id, { name: "Renamed" });
    const after = (await prisma.instance.findUnique({
      where: { id: created.id },
    }))!.apiKey;
    expect(after).toBe(before);
  });
});

describe("InstanceRepository.delete", () => {
  test("removes the row", async () => {
    const created = await instanceRepository.create(baseData);
    await instanceRepository.delete(created.id);
    expect(await instanceRepository.findById(created.id)).toBeNull();
  });
});

describe("InstanceRepository.migrateUnencrypted", () => {
  test("encrypts plaintext rows in place and returns the count", async () => {
    // Insert a plaintext row directly (simulating pre-encryption-at-rest data).
    await prisma.instance.create({
      data: { ...baseData, apiKey: "plaintext-key-here" },
    });
    await prisma.instance.create({
      data: {
        ...baseData,
        name: "Already encrypted",
        apiKey: "v1:not-real-but-prefixed",
      },
    });

    const migrated = await instanceRepository.migrateUnencrypted();
    expect(migrated).toBe(1);

    const rows = await prisma.instance.findMany();
    expect(rows.every((r) => isEncrypted(r.apiKey))).toBe(true);
  });

  test("returns 0 when all rows are already encrypted", async () => {
    await instanceRepository.create(baseData);
    expect(await instanceRepository.migrateUnencrypted()).toBe(0);
  });
});
