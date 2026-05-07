import { test, expect } from "@playwright/test";
import type { PaginatedResponse } from "@/shared/types/api";
import type { MovieItem } from "@/shared/types/models";

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

function makeMovie(instanceTag: string, id: number): MovieItem {
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
    monitored: true,
    existingFileCount: 1,
    totalFileCount: 1,
    flagged: true,
  };
}

test.beforeEach(async ({ page }) => {
  await page.route("**/api/instances", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({ status: 200, json: FAKE_INSTANCES });
    }
    return route.continue();
  });

  await page.route("**/api/radarr/movies**", (route) => {
    const url = new URL(route.request().url());
    const instanceId = url.searchParams.get("instanceId");
    if (!instanceId)
      return route.fulfill({
        status: 400,
        json: { error: "missing instanceId" },
      });
    const tag = instanceId === "1" ? "Main" : "4K";
    const body: PaginatedResponse<MovieItem> = {
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

test("instance switcher reloads the table with the chosen instance's movies", async ({
  page,
}) => {
  await page.goto("/movies");

  // Default lands on Radarr-Main.
  await expect(
    page.getByTestId("media-table-body").getByText(/Movie 100 \(Main\)/),
  ).toBeVisible({ timeout: 10_000 });

  // Open the instance Select and switch to Radarr-4K. The header banner
  // also renders the instance name above the dropdown — target the trigger
  // by testid to disambiguate.
  await page.getByTestId("instance-switcher").click();
  await page.getByRole("option", { name: "Radarr-4K" }).click();

  // Table now reflects Radarr-4K only — no "All" view exists.
  await expect(
    page.getByTestId("media-table-body").getByText(/Movie 200 \(4K\)/),
  ).toBeVisible({ timeout: 10_000 });
  await expect(
    page.getByTestId("media-table-body").getByText(/Movie 100 \(Main\)/),
  ).toHaveCount(0);
});

test("legacy ?instanceId=all URL silently falls back to the first instance", async ({
  page,
}) => {
  await page.goto("/movies?instanceId=all");

  // No "All Radarr" option exists; URL is treated as invalid and falls back
  // to the first instance (Radarr-Main).
  await expect(
    page.getByTestId("media-table-body").getByText(/Movie 100 \(Main\)/),
  ).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("All Radarr", { exact: true })).toHaveCount(0);
});
