import { describe, test, expect } from "vitest";
import { configRepository } from "@/server/repositories/ConfigRepository";
import { ConfigKey } from "@/server/config/keys";
import { prisma } from "@/server/lib/db";

describe("ConfigRepository", () => {
  test("get returns null for an unset key", async () => {
    expect(await configRepository.get("missing")).toBeNull();
  });

  test("set inserts a new row", async () => {
    await configRepository.set("dryRun", "true");
    expect(await configRepository.get("dryRun")).toBe("true");
  });

  test("set updates an existing row (upsert)", async () => {
    await configRepository.set("dryRun", "true");
    await configRepository.set("dryRun", "false");
    expect(await configRepository.get("dryRun")).toBe("false");
    // Only one row should exist.
    expect(await prisma.appConfig.count({ where: { key: "dryRun" } })).toBe(1);
  });

  test("findAll returns every config row", async () => {
    await prisma.appConfig.deleteMany();
    await configRepository.set("a", "1");
    await configRepository.set("b", "2");
    const all = await configRepository.findAll();
    expect(all).toHaveLength(2);
  });

  test("create accepts a typed AppConfig payload", async () => {
    const created = await configRepository.create({ key: "k", value: "v" });
    expect(created).toMatchObject({ key: "k", value: "v" });
  });

  test("findById always returns null (composite-keyed table)", async () => {
    expect(await configRepository.findById(0)).toBeNull();
  });

  test("update throws — config rows must be set via set()", async () => {
    await expect(configRepository.update(0, {})).rejects.toThrow(/set/);
  });

  test("delete throws — must use prisma directly", async () => {
    await expect(configRepository.delete(0)).rejects.toThrow();
  });

  describe("typed accessors", () => {
    test("getTyped returns the spec default when the key is unset", async () => {
      // setup.ts seeds dryRun=false; clear it so we hit the no-row branch.
      await prisma.appConfig.deleteMany({ where: { key: "dryRun" } });
      expect(await configRepository.getTyped(ConfigKey.DryRun)).toBe(true);
      expect(await configRepository.getTyped(ConfigKey.ApiKey)).toBeNull();
    });

    test("setTyped encodes via the spec, getTyped decodes back to the typed value", async () => {
      await configRepository.setTyped(ConfigKey.DryRun, false);
      expect(await configRepository.get("dryRun")).toBe("false");
      expect(await configRepository.getTyped(ConfigKey.DryRun)).toBe(false);
    });

    test("DryRun.parse treats anything other than 'true' as false", async () => {
      await configRepository.set("dryRun", "garbage");
      expect(await configRepository.getTyped(ConfigKey.DryRun)).toBe(false);
    });

    test("ApiKey round-trips a stored string", async () => {
      await configRepository.setTyped(ConfigKey.ApiKey, "abcd1234");
      expect(await configRepository.getTyped(ConfigKey.ApiKey)).toBe("abcd1234");
    });
  });
});
