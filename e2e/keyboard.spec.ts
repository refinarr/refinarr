import { test, expect } from "@playwright/test";

test.use({ storageState: "e2e/.auth/user.json" });

test.beforeEach(async ({ page }) => {
  // Stub /api/instances so /dashboard renders past the loading state.
  await page.route("**/api/instances", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({ status: 200, json: [] });
    }
    return route.continue();
  });
  await page.route("**/api/dashboard/summary**", (route) =>
    route.fulfill({
      status: 200,
      json: {
        totals: { flaggedMovies: 0, flaggedSeries: 0, failedActions24h: 0 },
        perInstance: [],
        recentActivity: [],
      },
    }),
  );
});

test("Cmd+K opens the command palette and Enter on a command navigates", async ({
  page,
}) => {
  await page.goto("/dashboard");

  // Open the palette. Use Meta on macOS / Control elsewhere — Playwright's
  // ControlOrMeta normalizes for the running platform.
  await page.keyboard.press("ControlOrMeta+k");

  const palette = page.getByPlaceholder(/type a command/i);
  await expect(palette).toBeVisible({ timeout: 5_000 });

  // Type "shows" to filter to the Shows command, then press Enter.
  await palette.fill("shows");
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(/\/shows/, { timeout: 5_000 });
});

test("? opens the keyboard help dialog", async ({ page }) => {
  await page.goto("/dashboard");
  // Wait until the dashboard sidebar is visible — proxy for "client hydrated
  // and document keydown listener attached". Without this, the dispatched
  // keydown can fire before KeyboardHelpDialog's effect has subscribed.
  await page
    .getByRole("link", { name: /^Dashboard$/ })
    .waitFor({ state: "visible" });
  await page.evaluate(() => {
    document.body.dispatchEvent(
      new KeyboardEvent("keydown", { key: "?", bubbles: true }),
    );
  });
  await expect(
    page.getByRole("heading", { name: /keyboard shortcuts/i }),
  ).toBeVisible({ timeout: 5_000 });
});
