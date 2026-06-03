import { test, expect } from "@playwright/test";
import { stubMediaApis } from "./mocks";

// I7 + F23 — command palette under concurrent network load + open latency.
// Functional contract only; the precise cold/warm latency numbers live in
// perf-bench (Phase 5 / #81), so the budget here is a generous ceiling.

test.use({
  storageState: "e2e/.auth/user.json",
  viewport: { width: 1280, height: 800 },
});

test("I7: palette opens and navigates while media is loading", async ({
  page,
}) => {
  await stubMediaApis(page);
  // Slow movies response keeps a fetch in-flight while we drive the palette.
  await page.route("**/api/radarr/movies**", async (route) => {
    await new Promise((r) => setTimeout(r, 1_500));
    return route.fulfill({
      status: 200,
      json: { items: [], total: 0, page: 1, limit: 50, hasMore: false },
    });
  });

  await page.goto("/movies"); // fetch now in-flight
  await page.keyboard.press("ControlOrMeta+k");
  const input = page.getByPlaceholder(/type a command/i);
  await expect(input).toBeVisible({ timeout: 5_000 });

  await input.fill("Settings");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/settings/, { timeout: 5_000 });
});

test("F23: palette open latency stays under budget (cold + warm)", async ({
  page,
}) => {
  await stubMediaApis(page);
  await page.goto("/dashboard");

  const input = page.getByPlaceholder(/type a command/i);
  const BUDGET_MS = 1_500; // generous CI ceiling, not the perf-bench gate

  // Cold open.
  let start = Date.now();
  await page.keyboard.press("ControlOrMeta+k");
  await expect(input).toBeVisible({ timeout: BUDGET_MS });
  expect(Date.now() - start).toBeLessThan(BUDGET_MS);

  await page.keyboard.press("Escape");
  await expect(input).toBeHidden();

  // Warm open (cmdk already mounted once).
  start = Date.now();
  await page.keyboard.press("ControlOrMeta+k");
  await expect(input).toBeVisible({ timeout: BUDGET_MS });
  expect(Date.now() - start).toBeLessThan(BUDGET_MS);
});
