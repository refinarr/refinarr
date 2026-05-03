import { test, expect } from "@playwright/test";
import type { PaginatedResponse } from "@/shared/types/api";
import type { FlaggedMovie } from "@/shared/types/models";

test.use({ storageState: "e2e/.auth/user.json" });

const FAKE_INSTANCES = [
  {
    id: 1,
    type: "radarr",
    name: "Radarr-Main",
    url: "http://192.168.1.100:7878",
    enabled: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 2,
    type: "radarr",
    name: "Radarr-4K",
    url: "http://192.168.1.101:7878",
    enabled: true,
    createdAt: new Date().toISOString(),
  },
];

function makeMovie(instanceTag: string, id: number): FlaggedMovie {
  return {
    id,
    title: `Movie ${id} (${instanceTag})`,
    year: 2024,
    qualityProfileId: 1,
    movieFileId: id,
    customFormats: [],
    customFormatScore: 0,
    hasFile: true,
    cfScore: 0,
    missingFormats: [{ id: 99, name: "HDR" }],
    unwantedFormats: [],
    sizeOnDisk: 1_000_000_000,
  } as unknown as FlaggedMovie;
}

test.beforeEach(async ({ page }) => {
  await page.route("**/api/instances", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({ status: 200, json: FAKE_INSTANCES });
    }
    return route.continue();
  });

  // Per-instance movie listing — use mode=all branch's limit=200 OR the
  // single-instance branch's limit=50; either way, return one movie per
  // instance so we can verify aggregation works.
  await page.route("**/api/radarr/movies**", (route) => {
    const url = new URL(route.request().url());
    const instanceId = url.searchParams.get("instanceId");
    if (!instanceId) return route.fulfill({ status: 400, json: { error: "missing instanceId" } });
    const tag = instanceId === "1" ? "Main" : "4K";
    const body: PaginatedResponse<FlaggedMovie> = {
      items: [makeMovie(tag, Number(instanceId) * 100)],
      total: 1,
      page: 1,
      limit: Number(url.searchParams.get("limit") ?? "50"),
      hasMore: false,
    };
    return route.fulfill({ status: 200, json: body });
  });

  await page.route("**/api/radarr/qualityprofiles**", (route) =>
    route.fulfill({ status: 200, json: [] }),
  );
  await page.route("**/api/preferences**", (route) =>
    route.fulfill({ status: 200, json: [] }),
  );
});

test("All Radarr aggregates flagged movies across instances", async ({ page }) => {
  await page.goto("/movies");

  // Single-instance mode loads first; Radarr-Main shows.
  await expect(
    page.getByTestId("media-table-body").getByText(/Movie 100 \(Main\)/),
  ).toBeVisible({ timeout: 10_000 });

  // Open the instance Select by clicking its current value (the trigger
  // displays the active instance name) then pick "All Radarr".
  await page.getByText("Radarr-Main", { exact: true }).first().click();
  await page.getByText("All Radarr", { exact: true }).click();

  // Both instance results should now be in the table body.
  await expect(
    page.getByTestId("media-table-body").getByText(/Movie 100 \(Main\)/),
  ).toBeVisible({ timeout: 10_000 });
  await expect(
    page.getByTestId("media-table-body").getByText(/Movie 200 \(4K\)/),
  ).toBeVisible();
});

test("Multi-instance bulk delete confirm shows per-instance breakdown", async ({ page }) => {
  let upstreamHits = 0;
  await page.route("**/api/radarr/movies/delete**", (route) => {
    upstreamHits += 1;
    const id = Number(JSON.parse(String(route.request().postData() ?? "{}")).instanceId ?? 0);
    return route.fulfill({
      status: 200,
      json: {
        id: upstreamHits,
        instanceId: id,
        action: "delete",
        mediaId: id * 100,
        title: `Movie ${id * 100}`,
        isDryRun: true,
        status: "dry_run",
        createdAt: new Date().toISOString(),
      },
    });
  });

  await page.goto("/movies");
  await page.getByTestId("media-table-body").getByText(/Movie 100 \(Main\)/).waitFor({ timeout: 10_000 });

  // Switch to All Radarr.
  await page.getByText("Radarr-Main", { exact: true }).first().click();
  await page.getByText("All Radarr", { exact: true }).click();

  // Wait for the second-instance row to appear.
  await page.getByTestId("media-table-body").getByText(/Movie 200 \(4K\)/).waitFor({ timeout: 10_000 });

  // Select both rows via their checkboxes. base-ui's Checkbox primitive
  // renders with data-slot="checkbox"; that's what shadcn's wrapper sets.
  const checkboxes = page.getByTestId("media-table-body").locator('[data-slot="checkbox"]');
  await checkboxes.nth(0).click();
  await checkboxes.nth(1).click();

  // The delete button is in the bulk toolbar; click "Delete" (not "Delete and search").
  await page.getByRole("button", { name: /^delete$/i }).first().click();

  // The confirm dialog should show the per-instance breakdown.
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible({ timeout: 5_000 });
  await expect(dialog).toContainText(/from Radarr-Main/i);
  await expect(dialog).toContainText(/from Radarr-4K/i);
});
