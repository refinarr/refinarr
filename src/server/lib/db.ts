import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import crypto from "crypto";
import { LogSource } from "./log-sources";

function createPrismaClient(): PrismaClient {
  const dbUrl =
    process.env.DATABASE_URL ??
    (process.env.NODE_ENV === "production"
      ? "file:///data/data.db"
      : "file:./dev.db");

  const adapter = new PrismaLibSql({ url: dbUrl });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export async function seedDefaults() {
  const dryRun = await prisma.appConfig.findUnique({ where: { key: "dryRun" } });
  if (!dryRun) {
    await prisma.appConfig.create({ data: { key: "dryRun", value: "true" } });
  }

  const apiKey = await prisma.appConfig.findUnique({ where: { key: "apiKey" } });
  if (!apiKey) {
    const generated = crypto.randomBytes(16).toString("hex");
    await prisma.appConfig.create({ data: { key: "apiKey", value: generated } });
  }

  // One-shot migration: encrypt any pre-existing instance.apiKey rows that
  // were stored as plaintext before the v1: encryption-at-rest change.
  const { instanceRepository } = await import("@/server/repositories/InstanceRepository");
  const migrated = await instanceRepository.migrateUnencrypted();
  if (migrated > 0) {
    const { appLogger } = await import("./app-logger");
    appLogger.info("Encrypted existing instance API keys at rest", {
      source: LogSource.Db,
      context: { count: migrated },
    });
  }
}
