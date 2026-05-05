import { describe, test, expect } from "vitest";
import { dryRunService } from "@/server/services/DryRunService";
import { configRepository } from "@/server/repositories/ConfigRepository";

describe("DryRunService", () => {
  test("isDryRun is false when the config row is missing", async () => {
    expect(await dryRunService.isDryRun()).toBe(false);
  });

  test("isDryRun is true when AppConfig.dryRun = 'true'", async () => {
    await configRepository.set("dryRun", "true");
    expect(await dryRunService.isDryRun()).toBe(true);
  });

  test("isDryRun is false when value is anything other than 'true'", async () => {
    await configRepository.set("dryRun", "false");
    expect(await dryRunService.isDryRun()).toBe(false);
  });

  test("setDryRun(true) persists 'true'", async () => {
    await dryRunService.setDryRun(true);
    expect(await configRepository.get("dryRun")).toBe("true");
  });

  test("setDryRun(false) persists 'false'", async () => {
    await dryRunService.setDryRun(true);
    await dryRunService.setDryRun(false);
    expect(await configRepository.get("dryRun")).toBe("false");
  });

  test("withDryRun returns the dry result without invoking liveAction in dry mode", async () => {
    let called = false;
    const result = await dryRunService.withDryRun(
      true,
      async () => {
        called = true;
        return "live";
      },
      "dry",
    );
    expect(result).toBe("dry");
    expect(called).toBe(false);
  });

  test("withDryRun invokes liveAction in live mode", async () => {
    const result = await dryRunService.withDryRun(
      false,
      async () => "live",
      "dry",
    );
    expect(result).toBe("live");
  });
});
