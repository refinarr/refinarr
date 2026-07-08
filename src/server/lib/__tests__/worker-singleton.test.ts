import { describe, test, expect, vi, afterEach } from "vitest";

// #135 — Next.js evaluates server modules in more than one context (the
// instrumentation bundle vs the route/server bundle). The worker singletons
// must therefore dedup via globalThis in PRODUCTION too — otherwise each
// context builds AND starts its own worker and the queue drains twice
// (duplicate searches / grabs / history rows). Before the fix the
// `globalThis.<worker> = <worker>` assignment was gated to dev only, so a
// production re-evaluation always constructed a fresh instance.

const CASES = [
  {
    mod: "@/server/lib/auto-runner",
    exportName: "autoRunner",
    globalKey: "autoRunner",
  },
  {
    mod: "@/server/lib/search-worker",
    exportName: "searchWorker",
    globalKey: "searchWorker",
  },
  {
    mod: "@/server/lib/status-poller",
    exportName: "statusPoller",
    globalKey: "statusPoller",
  },
] as const;

type GlobalRec = Record<string, unknown>;

describe("worker singletons dedup across module re-evaluations in production (#135)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    for (const { globalKey } of CASES)
      delete (globalThis as GlobalRec)[globalKey];
    vi.resetModules();
  });

  test.each(CASES)(
    "$exportName reuses one instance on a second prod evaluation",
    async ({ mod, exportName, globalKey }) => {
      vi.stubEnv("NODE_ENV", "production");
      delete (globalThis as GlobalRec)[globalKey];
      vi.resetModules();

      const first = (await import(mod))[exportName];
      // The global must be populated in prod (the fix) so later evaluations
      // can find it.
      expect((globalThis as GlobalRec)[globalKey]).toBe(first);

      vi.resetModules();
      const second = (await import(mod))[exportName];
      // Second evaluation reuses the same instance rather than starting a
      // second worker.
      expect(second).toBe(first);
    },
  );
});
