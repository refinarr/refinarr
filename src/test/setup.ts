import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll, beforeEach } from "vitest";
import { cleanup } from "@testing-library/react";
import { prisma } from "@/server/lib/db";
import { dataCache } from "@/server/lib/data-cache";
import { inertScheduler } from "@/server/lib/scheduler";
import { mswServer } from "@/test/msw";
import { setBackgroundServicesScheduler } from "@/test/background-services";

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
//
// dryRun is explicitly seeded false so live-mode integration tests can assert
// the success path. Production's first-launch default is true (dry-run on);
// individual tests that exercise dry-run flip it back.
beforeEach(async () => {
  // Quiesce the background-service singletons FIRST — before truncating
  // tables — so a leaked real timer from a prior test can't fire mid-
  // cleanup. setBackgroundServicesScheduler stops each service with its
  // current scheduler, then leaves it inert: a route's start()/refresh()
  // side effect registers timers that never fire, so it can't spin up
  // real *arr polling and trip MSW's onUnhandledRequest guard. Each
  // service's own test file resets its scheduler to realScheduler.
  await setBackgroundServicesScheduler(inertScheduler);
  await prisma.$transaction([
    prisma.session.deleteMany(),
    prisma.user.deleteMany(),
    prisma.actionLog.deleteMany(),
    prisma.appLog.deleteMany(),
    prisma.cfPreference.deleteMany(),
    prisma.ignoreEntry.deleteMany(),
    prisma.searchQueue.deleteMany(),
    prisma.appConfig.deleteMany(),
    prisma.instance.deleteMany(),
  ]);
  await prisma.appConfig.create({ data: { key: "dryRun", value: "false" } });
  dataCache.clear();
});
