import crypto from "crypto";
import { prisma } from "./db";
import { appLogger } from "./app-logger";
import { LogSource } from "./log-sources";
import { instanceRepository } from "@/server/repositories/InstanceRepository";

let seeded = false;

export async function seedDefaults(): Promise<void> {
  const dryRun = await prisma.appConfig.findUnique({ where: { key: "dryRun" } });
  if (!dryRun) {
    await prisma.appConfig.create({ data: { key: "dryRun", value: "true" } });
  }

  const apiKey = await prisma.appConfig.findUnique({ where: { key: "apiKey" } });
  if (!apiKey) {
    const generated = crypto.randomBytes(16).toString("hex");
    await prisma.appConfig.create({ data: { key: "apiKey", value: generated } });
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
