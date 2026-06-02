import { test, expect, type Page, type Route } from "@playwright/test";
import { stubMediaApis, movie } from "./mocks";

// C5 / C6 — bulk-action correctness. Search dispatches one POST per item
// to /api/radarr/movies/search, so we intercept those to assert exactly
// which items were queued.

test.use({ storageState: "e2e/.auth/user.json" });

const SEARCH = "**/api/radarr/movies/search";
const selectAll = (p: Page) =>
  p.getByRole("checkbox", { name: /select all visible items/i });
const toolbar = (p: Page) => p.getByRole("region", { name: /selected/i });

// C5 — "Select all" only ever selects the loaded (server-filtered) rows,
// so a bulk action queues exactly those — never some larger hidden set.
test("C5: select-all bulk-search queues only the visible items", async ({
  page,
}) => {
  await stubMediaApis(page, {
    movies: [
      movie({ id: 1, title: "Alpha" }),
      movie({ id: 2, title: "Bravo" }),
    ],
  });
  const queued: number[] = [];
  // Registered after stubMediaApis so this more-specific route wins for
  // the POST (Playwright runs the last-registered matching handler first).
  await page.route(SEARCH, (route: Route) => {
    queued.push(
      (route.request().postDataJSON() as { mediaId: number }).mediaId,
    );
    return route.fulfill({ status: 200, json: {} });
  });

  await page.goto("/movies");
  await expect(page.getByTestId("media-table-body")).toBeVisible({
    timeout: 10_000,
  });

  await selectAll(page).click();
  const bar = toolbar(page);
  await expect(bar).toHaveAccessibleName(/2 selected/i);
  await bar.getByRole("button", { name: "Search", exact: true }).click();

  await expect.poll(() => queued.length, { timeout: 10_000 }).toBe(2);
  expect([...queued].sort((a, b) => a - b)).toEqual([1, 2]);
});

// C6 — cancelling a bulk mid-flight aborts the serial loop, so the
// remaining items are never queued.
test("C6: cancelling a bulk stops queuing the remaining items", async ({
  page,
}) => {
  await stubMediaApis(page, {
    movies: [movie({ id: 1 }), movie({ id: 2 }), movie({ id: 3 })],
  });
  const queued: number[] = [];
  await page.route(SEARCH, async (route: Route) => {
    queued.push(
      (route.request().postDataJSON() as { mediaId: number }).mediaId,
    );
    await new Promise((r) => setTimeout(r, 400)); // keep the loop in-flight
    return route.fulfill({ status: 200, json: {} });
  });

  await page.goto("/movies");
  await expect(page.getByTestId("media-table-body")).toBeVisible({
    timeout: 10_000,
  });
  await selectAll(page).click();
  const bar = toolbar(page);
  await bar.getByRole("button", { name: "Search", exact: true }).click();

  await expect
    .poll(() => queued.length, { timeout: 5_000 })
    .toBeGreaterThanOrEqual(1);
  await bar.getByRole("button", { name: /cancel/i }).click();

  // Give the serial loop time to either finish or abort, then assert it
  // stopped short of all three.
  await page.waitForTimeout(1_500);
  expect(queued.length).toBeLessThan(3);
});

// C6 — navigating away mid-bulk doesn't crash the app.
test("C6: navigating away mid-bulk lands on the next page cleanly", async ({
  page,
}) => {
  await stubMediaApis(page, {
    movies: [movie({ id: 1 }), movie({ id: 2 }), movie({ id: 3 })],
  });
  await page.route(SEARCH, async (route: Route) => {
    await new Promise((r) => setTimeout(r, 400));
    return route.fulfill({ status: 200, json: {} });
  });

  await page.goto("/movies");
  await expect(page.getByTestId("media-table-body")).toBeVisible({
    timeout: 10_000,
  });
  await selectAll(page).click();
  await toolbar(page)
    .getByRole("button", { name: "Search", exact: true })
    .click();

  await page.goto("/dashboard");
  await expect(page.getByRole("link", { name: /^Dashboard$/ })).toBeVisible({
    timeout: 10_000,
  });
});
