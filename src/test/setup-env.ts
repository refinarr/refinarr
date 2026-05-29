import { copyFileSync, existsSync } from "fs";

// Per-worker env bootstrap. Runs BEFORE setup.ts so that setup.ts's
// `import { prisma } from "@/server/lib/db"` resolves the worker-scoped
// DATABASE_URL — not the template URL inherited from globalSetup.
//
// Each Vitest worker fork is a separate process (see `pool: "forks"`
// in vitest.config.ts) so `process.env.DATABASE_URL` is process-local
// and writes from one worker don't leak into another.

const poolId = process.env.VITEST_POOL_ID ?? "0";
const TEMPLATE_DB = "./local/vitest-template.db";
const WORKER_DB = `./local/vitest-test-${poolId}.db`;

// Fail fast — without the template, copyFileSync below is skipped, the
// worker DB never gets created, and Prisma later throws a cryptic
// "database file not found" instead of pointing at the real cause.
if (!existsSync(TEMPLATE_DB)) {
  throw new Error(
    `Template DB not found at ${TEMPLATE_DB}. Did global-setup.ts run?`,
  );
}

// Copy the migrated template once per worker; subsequent test files in
// the same worker process reuse it. globalSetup wipes both template
// and worker DBs at the start of each `yarn test`, so the template is
// always fresh.
if (!existsSync(WORKER_DB)) {
  copyFileSync(TEMPLATE_DB, WORKER_DB);
}

process.env.DATABASE_URL = `file:${WORKER_DB}`;
