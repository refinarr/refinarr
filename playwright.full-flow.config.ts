import { defineConfig, devices } from "@playwright/test";

// Full-flow config — runs against an already-running container (the real image)
// wired to a REAL Sonarr/Radarr. scripts/full-flow-test.sh starts the container
// and passes BASE_URL + ARR_* env. No webServer here.
const baseURL = process.env.BASE_URL ?? "http://localhost:7399";

export default defineConfig({
  testDir: "./e2e-fullflow",
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
