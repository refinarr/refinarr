import crypto from "crypto";
import { configRepository } from "@/server/repositories/ConfigRepository";
import { instanceRepository } from "@/server/repositories/InstanceRepository";
import { ConfigKey } from "@/server/config/keys";
import { LogSource } from "@/shared/types/models";
import { appLogger } from "./app-logger";
import { searchWorker } from "./search-worker";
import { statusPoller } from "./status-poller";
import { autoRunner } from "./auto-runner";
import { startRateLimitCleanup } from "./rate-limit";

let seeded = false;
let seedPromise: Promise<void> | null = null;

export async function seedDefaults(): Promise<void> {
  if ((await configRepository.get(ConfigKey.DryRun.key)) === null) {
    await configRepository.setTyped(ConfigKey.DryRun, ConfigKey.DryRun.default);
  }

  if ((await configRepository.get(ConfigKey.ApiKey.key)) === null) {
    const generated = crypto.randomBytes(16).toString("hex");
    await configRepository.setTyped(ConfigKey.ApiKey, generated);
  }

  const migrated = await instanceRepository.migrateUnencrypted();
  if (migrated > 0) {
    appLogger.info("Encrypted existing instance API keys at rest", {
      source: LogSource.Db,
      context: { count: migrated },
    });
  }

  // The three workers are independent and idempotent — each takes its own
  // findAllEnabled() snapshot; one drains the search queue, one observes
  // upstream lifecycle for dispatched commands, one schedules auto-searches.
  // Start them concurrently so boot isn't three sequential awaits.
  await Promise.all([
    searchWorker.start(),
    statusPoller.start(),
    autoRunner.start(),
  ]);
  startRateLimitCleanup();
}

export async function ensureSeeded(): Promise<void> {
  if (seeded) return;
  if (!seedPromise) {
    seedPromise = seedDefaults()
      .then(() => {
        seeded = true;
      })
      .finally(() => {
        seedPromise = null;
      });
  }
  await seedPromise;
}
