import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach } from "vitest";
import { cleanup } from "@testing-library/react";
import { prisma } from "@/server/lib/db";
import { dataCache } from "@/server/lib/DataCache";

afterEach(() => {
  cleanup();
});

// Truncate every table and clear in-memory caches before each test so DB-backed
// tests are hermetic. Order matters for FK relations; SQLite doesn't enforce
// them by default, but consistent order keeps things predictable.
beforeEach(async () => {
  await prisma.$transaction([
    prisma.session.deleteMany(),
    prisma.user.deleteMany(),
    prisma.actionLog.deleteMany(),
    prisma.appLog.deleteMany(),
    prisma.cfPreference.deleteMany(),
    prisma.ignoreEntry.deleteMany(),
    prisma.appConfig.deleteMany(),
    prisma.instance.deleteMany(),
  ]);
  dataCache.clear();
});
