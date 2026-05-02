import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll, beforeEach } from "vitest";
import { cleanup } from "@testing-library/react";
import { prisma } from "@/server/lib/db";
import { dataCache } from "@/server/lib/DataCache";
import { mswServer } from "@/test/msw";

beforeAll(() => {
  // Surface unhandled outbound requests so we don't silently call real Sonarr/Radarr.
  mswServer.listen({ onUnhandledRequest: "error" });
});

afterAll(() => {
  mswServer.close();
});

afterEach(() => {
  cleanup();
  // Reset MSW handlers added per-test via mswServer.use(...).
  mswServer.resetHandlers();
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
