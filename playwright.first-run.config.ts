import { defineConfig, devices } from "@playwright/test";

// First-run test config — runs against an ALREADY-RUNNING container (the real
// Docker image), NOT `next start`. scripts/first-run-test.sh builds + starts a
// fresh container over plain HTTP and passes BASE_URL. Deliberately no
// `webServer` here: the whole point is to exercise the deployed image
// (entrypoint, migrate, standalone server, cookies over HTTP) — the layers the
// regular e2e suite never touches.
const baseURL = process.env.BASE_URL ?? "http://localhost:7399";

export default defineConfig({
  testDir: "./e2e-firstrun",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
