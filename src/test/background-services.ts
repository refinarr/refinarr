import type { Scheduler } from "@/server/lib/scheduler";

/**
 * Swap the Scheduler on the three long-lived background-service singletons
 * (auto-runner, status-poller, search-worker).
 *
 * Imported dynamically: this module is reachable from `src/test/setup.ts`
 * (a vitest setupFile, evaluated before any test file's hoisted
 * `vi.mock(...)`). A static import would pull the full service graph in
 * eagerly and defeat module-mock tests like `app-logger.test.ts`. The
 * dynamic `import()` defers the load until `beforeEach` runs, after each
 * file's mocks are registered.
 */
async function loadServices() {
  const [autoRunner, statusPoller, searchWorker] = await Promise.all([
    import("@/server/lib/auto-runner").then((m) => m.autoRunner),
    import("@/server/lib/status-poller").then((m) => m.statusPoller),
    import("@/server/lib/search-worker").then((m) => m.searchWorker),
  ]);
  return { autoRunner, statusPoller, searchWorker };
}

export async function setBackgroundServicesScheduler(
  scheduler: Scheduler,
): Promise<void> {
  const { autoRunner, statusPoller, searchWorker } = await loadServices();
  // Quiesce each service with the scheduler it CURRENTLY holds before
  // swapping. Swapping first would leave a service still holding real
  // timer handles, and its next stop() would call the new (inert) no-op
  // clearers on them — orphaning the very timers this swap neutralises.
  await autoRunner.stop();
  statusPoller.stop();
  searchWorker.stop();
  autoRunner.scheduler = scheduler;
  statusPoller.scheduler = scheduler;
  searchWorker.scheduler = scheduler;
}
