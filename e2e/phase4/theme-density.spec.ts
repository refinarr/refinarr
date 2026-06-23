import { test, expect } from "@playwright/test";
import { stubMediaApis, movie } from "./mocks";

// I6 + F22 — theme/density switching.
//
// These guard the *functional* contract (theme applied during fetch with
// no flash to default; density switch is client-side + instant, no full
// reload). The precise sub-50ms perf number lives in the perf-bench
// harness (Phase 5 / #81); a tight gate here would be flaky on CI runners,
// so the budgets below are generous "doesn't-hang" ceilings.

test.use({
  storageState: "e2e/.auth/user.json",
  viewport: { width: 1280, height: 800 },
});

test("I6: the persisted theme is applied while media is loading (no flicker)", async ({
  page,
}) => {
  await stubMediaApis(page);
  // Override the movies endpoint with a delayed response so there's a real
  // loading window to observe.
  await page.route("**/api/radarr/movies**", async (route) => {
    await new Promise((r) => setTimeout(r, 700));
    return route.fulfill({
      status: 200,
      json: { items: [], total: 0, page: 1, limit: 50, hasMore: false },
    });
  });

  await page.goto("/movies");
  await page.evaluate(() => {
    localStorage.setItem("rfn-brand", "teal");
    localStorage.setItem("rfn-mode", "dark");
  });
  await page.reload();

  const html = page.locator("html");
  // Applied on first paint, before the (delayed) data resolves.
  await expect(html).toHaveAttribute("data-theme", "teal", { timeout: 3_000 });
  await expect(html).toHaveClass(/dark/);

  // Still correct once the fetch settles — never flashed back to default.
  await page.waitForTimeout(1_000);
  await expect(html).toHaveAttribute("data-theme", "teal");
  await expect(html).toHaveClass(/dark/);
});

test("F22: density switch is client-side and instant (no reload)", async ({
  page,
}) => {
  // A row must exist for the density surfaces to render (vs the empty state).
  await stubMediaApis(page, { movies: [movie()] });
  await page.goto("/movies");
  // Start from compact (a table density) so one `,` cycle reaches `poster`,
  // a visibly different desktop surface (#129 removed desktop card view).
  await page.evaluate(() => localStorage.setItem("rfn-density", "compact"));
  await page.reload();
  await expect(page.getByTestId("media-table-body")).toBeVisible({
    timeout: 10_000,
  });

  // Sentinel survives only if the switch is a client re-render, not a reload.
  await page.evaluate(() => {
    (window as unknown as { __noReload: boolean }).__noReload = true;
  });

  const start = Date.now();
  await page.keyboard.press(","); // cycle compact → poster
  await expect(page.getByTestId("media-poster-grid")).toBeVisible({
    timeout: 5_000,
  });
  const elapsed = Date.now() - start;

  const survived = await page.evaluate(
    () => (window as unknown as { __noReload?: boolean }).__noReload === true,
  );
  expect(survived).toBe(true);
  // Generous ceiling — the strict <50ms measurement is perf-bench territory.
  expect(elapsed).toBeLessThan(2_000);
});
