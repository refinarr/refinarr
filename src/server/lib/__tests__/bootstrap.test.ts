import { describe, test, expect, beforeEach, vi } from "vitest";
import { seedDefaults } from "@/server/lib/bootstrap";
import { configRepository } from "@/server/repositories/ConfigRepository";
import { ConfigKey } from "@/server/config/keys";
import { prisma } from "@/server/lib/db";

vi.mock("@/server/lib/search-worker", () => ({
  searchWorker: {
    start: vi.fn(async () => undefined),
    refresh: vi.fn(async () => undefined),
    stop: vi.fn(),
  },
}));

describe("bootstrap.seedDefaults", () => {
  beforeEach(async () => {
    // setup.ts seeds dryRun=false unconditionally; clear it so we exercise
    // the "dryRun unset → seed default" branch.
    await prisma.appConfig.deleteMany();
  });

  test("seeds dryRun with the spec default when not set", async () => {
    expect(await configRepository.get(ConfigKey.DryRun.key)).toBeNull();
    await seedDefaults();
    expect(await configRepository.getTyped(ConfigKey.DryRun)).toBe(ConfigKey.DryRun.default);
  });

  test("seeds a 32-hex apiKey when not set", async () => {
    await seedDefaults();
    const apiKey = await configRepository.getTyped(ConfigKey.ApiKey);
    expect(apiKey).toMatch(/^[0-9a-f]{32}$/);
  });

  test("does not overwrite existing dryRun", async () => {
    await configRepository.setTyped(ConfigKey.DryRun, false);
    await seedDefaults();
    expect(await configRepository.getTyped(ConfigKey.DryRun)).toBe(false);
  });
});
