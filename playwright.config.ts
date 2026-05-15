import { defineConfig, devices } from "@playwright/test";

import { E2E_DB } from "./e2e/constants";

const E2E_PORT = 7373;
// Separate dist dir → separate lock file → no collision with the primary dev server.
const E2E_DIST = ".next-e2e";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "html",
  use: {
    baseURL: `http://localhost:${E2E_PORT}`,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // Sequential preflight: wipe -> migrate -> seed admin + auth state ->
    // build -> start. The seed runs in the webServer command chain
    // (not Playwright's globalSetup hook) so it completes BEFORE
    // `next start` opens any Prisma connection — eliminates the
    // cross-process visibility race where webServer's snapshot was
    // taken before globalSetup wrote the admin row.
    //
    // node --experimental-strip-types runs the .ts seed source directly
    // (Node 22+ feature; CI runners have it via setup-node and the
    // self-hosted image bundles node24). Avoids adding tsx as a dep
    // for one preflight script.
    command: `rm -f local/e2e-test.db local/e2e-test.db-journal local/e2e-test.db-wal local/e2e-test.db-shm local/.encryption-key.e2e && mkdir -p local && prisma migrate deploy && node --experimental-strip-types --no-warnings e2e/seed-admin.ts && next build && next start -p ${E2E_PORT}`,
    url: `http://localhost:${E2E_PORT}/api/health`,
    // Never reuse — seed-admin.ts wipes the DB so we always need a fresh server.
    reuseExistingServer: false,
    // First-run build can take ~60s; allow generous headroom.
    timeout: 240_000,
    env: {
      NEXT_DIST_DIR: E2E_DIST,
      DATABASE_URL: E2E_DB,
      // crypto.ts defaults to /data/.encryption-key when NODE_ENV=production;
      // that's a Docker-volume path. Override to a local file for the e2e run.
      ENCRYPTION_KEY_PATH: "./local/.encryption-key.e2e",
      LOG_LEVEL: "silent",
    },
  },
});
