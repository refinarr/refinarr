import { defineConfig, devices } from "@playwright/test";

const E2E_PORT = 7373;
const E2E_DB = "file:./local/e2e-test.db";
// Separate dist dir → separate lock file → no collision with the primary dev server.
const E2E_DIST = ".next-e2e";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
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
    // Production build + start. ~30s up-front cost (cached in .next-e2e for
    // subsequent runs when source hasn't changed) but page loads after that
    // are 100-200ms instead of the multi-second cold compiles `next dev` takes.
    // Eliminates the per-test 30s timeout flakiness we saw with dev mode.
    command: `next build && next start -p ${E2E_PORT}`,
    url: `http://localhost:${E2E_PORT}/api/health`,
    // Never reuse — globalSetup wipes the DB so we always need a fresh server.
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
