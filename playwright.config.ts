import { defineConfig, devices } from "@playwright/test";

const E2E_PORT = 7373;
const E2E_DB = "file:./e2e-test.db";
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
    command: `next dev -p ${E2E_PORT}`,
    url: `http://localhost:${E2E_PORT}/api/health`,
    // Never reuse — globalSetup wipes the DB so we always need a fresh server.
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      NEXT_DIST_DIR: E2E_DIST,
      DATABASE_URL: E2E_DB,
      LOG_LEVEL: "silent",
    },
  },
});
