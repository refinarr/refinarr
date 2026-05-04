import crypto from "crypto";
import { appLogger } from "./app-logger";
import { LogSource } from "./log-sources";
import { configRepository } from "@/server/repositories/ConfigRepository";
import { instanceRepository } from "@/server/repositories/InstanceRepository";
import { ConfigKey } from "@/server/config/keys";

let seeded = false;

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
}

export async function ensureSeeded(): Promise<void> {
  if (seeded) return;
  await seedDefaults();
  seeded = true;
}
