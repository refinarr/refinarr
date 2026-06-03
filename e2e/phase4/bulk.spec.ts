import { test, expect, type Page, type Route } from "@playwright/test";
import { stubMediaApis, movie, setDensity } from "./mocks";

// C5 / C6 — bulk-action correctness. Search dispatches one POST per item
// to /api/radarr/movies/search, so we intercept those to assert exactly
// which items were queued. #95: every test sets its density explicitly
// (table via "cozy", plus card + poster siblings) rather than relying on
// the default surface.

test.use({
  storageState: "e2e/.auth/user.json",
  viewport: { width: 1280, height: 800 },
});

const SEARCH = "**/api/radarr/movies/search";
const selectAll = (p: Page) =>
  p.getByRole("checkbox", { name: /select all visible items/i });
const toolbar = (p: Page) => p.getByRole("region", { name: /selected/i });

function hasMediaId(body: unknown): body is { mediaId: number } {
  return (
    typeof body === "object" &&
    body !== null &&
    "mediaId" in body &&
    typeof (body as { mediaId: unknown }).mediaId === "number"
  );
}

// Intercept the per-item search POSTs, recording the queued media ids.
// `queued` is optional — the cancel/navigate specs only need the delay.
function captureSearches(page: Page, queued?: number[], delayMs = 0) {
  return page.route(SEARCH, async (route: Route) => {
    if (queued) {
      const body = route.request().postDataJSON();
      if (!hasMediaId(body)) {
        throw new Error(`Unexpected search body: ${JSON.stringify(body)}`);
      }
      queued.push(body.mediaId);
    }
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    return route.fulfill({ status: 200, json: {} });
  });
}

// Open /movies in a specific density and wait for its surface to render.
async function openMovies(
  page: Page,
  density: string,
  testid: string,
): Promise<void> {
  await page.goto("/movies");
  await setDensity(page, density);
  await expect(page.getByTestId(testid)).toBeVisible({ timeout: 10_000 });
}

// C5 — table "Select all" only ever selects the loaded (server-filtered)
// rows, so a bulk action queues exactly those — never some larger hidden set.
test("C5: select-all bulk-search queues only the visible items (table)", async ({
  page,
}) => {
  await stubMediaApis(page, {
    movies: [
      movie({ id: 1, title: "Alpha" }),
      movie({ id: 2, title: "Bravo" }),
    ],
  });
  const queued: number[] = [];
  await captureSearches(page, queued);

  await openMovies(page, "cozy", "media-table-body");

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
  await captureSearches(page, queued, 400); // keep the loop in-flight

  await openMovies(page, "cozy", "media-table-body");
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
  await captureSearches(page, undefined, 400);

  await openMovies(page, "cozy", "media-table-body");
  await selectAll(page).click();
  await toolbar(page)
    .getByRole("button", { name: "Search", exact: true })
    .click();

  await page.goto("/dashboard");
  await expect(page.getByRole("link", { name: /^Dashboard$/ })).toBeVisible({
    timeout: 10_000,
  });
});

// C5 sibling — bulk works on the card + poster surfaces too, selecting
// items via the per-item checkbox (those surfaces have no "select all").
for (const surface of [
  { density: "card", testid: "media-card-list" },
  { density: "poster", testid: "media-poster-grid" },
]) {
  test(`C5: per-item select + bulk-search queues the picked items (${surface.density})`, async ({
    page,
  }) => {
    await stubMediaApis(page, {
      movies: [movie({ id: 1 }), movie({ id: 2 }), movie({ id: 3 })],
    });
    const queued: number[] = [];
    await captureSearches(page, queued);

    await openMovies(page, surface.density, surface.testid);

    const checks = page.getByTestId("media-select-target");
    await checks.nth(0).click();
    await checks.nth(1).click();

    const bar = toolbar(page);
    await expect(bar).toHaveAccessibleName(/2 selected/i);
    await bar.getByRole("button", { name: "Search", exact: true }).click();

    await expect.poll(() => queued.length, { timeout: 10_000 }).toBe(2);
  });
}
