import { test, expect } from "@playwright/test";
import type { PaginatedResponse } from "@/shared/types/api";
import type { MovieItem } from "@/shared/types/models";

test.use({
  storageState: "e2e/.auth/user.json",
  viewport: { width: 390, height: 844 },
});

const FAKE_INSTANCE = {
  id: 1,
  type: "radarr",
  name: "Mock Radarr",
  url: "http://192.168.1.100:7878",
  enabled: true,
  createdAt: new Date().toISOString(),
};

const FAKE_MOVIE: MovieItem = {
  id: 1,
  title: "The Missing Format",
  year: 2024,
  qualityProfileId: 1,
  movieFileId: 101,
  customFormats: [],
  customFormatScore: 0,
  hasFile: true,
  cfScore: 0,
  missingFormats: [{ id: 99, name: "HDR" }],
  unwantedFormats: [],
  sizeOnDisk: 5_000_000_000,
  monitored: true,
  existingFileCount: 1,
  totalFileCount: 1,
  flagged: true,
};

const FAKE_RESPONSE: PaginatedResponse<MovieItem> = {
  items: [FAKE_MOVIE],
  total: 1,
  page: 1,
  limit: 50,
  hasMore: false,
};

test.beforeEach(async ({ page }) => {
  await page.route("**/api/instances", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({ status: 200, json: [FAKE_INSTANCE] });
    }
    return route.continue();
  });
  await page.route("**/api/radarr/movies**", (route) =>
    route.fulfill({ status: 200, json: FAKE_RESPONSE }),
  );
  await page.route("**/api/radarr/qualityprofiles**", (route) =>
    route.fulfill({ status: 200, json: [] }),
  );
  await page.route("**/api/preferences**", (route) =>
    route.fulfill({ status: 200, json: [] }),
  );
});

test("mobile bottom tab bar exposes primary nav and the More button opens the secondary-nav sheet", async ({
  page,
}) => {
  await page.goto("/dashboard");

  // Primary destinations live in the always-visible MobileTabBar. The
  // sidebar's hamburger is hidden below md, so the tab bar is the only
  // entry point on mobile.
  const tabBar = page.getByRole("navigation", { name: /primary navigation/i });
  await expect(tabBar).toBeVisible({ timeout: 5_000 });
  await expect(tabBar.getByRole("link", { name: /movies/i })).toBeVisible();
  await expect(tabBar.getByRole("link", { name: /shows/i })).toBeVisible();
  await expect(
    page.getByRole("button", { name: /open navigation menu/i }),
  ).toBeHidden();

  // Secondary routes (Settings / Logs / etc.) live behind the More
  // button, which opens a sheet containing the rest of NavContent.
  await tabBar.getByRole("button", { name: /open more menu/i }).click();
  await expect(page.getByRole("link", { name: /settings/i })).toBeVisible({
    timeout: 5_000,
  });
  await expect(page.getByRole("link", { name: /logs/i })).toBeVisible();
});

test("movies page renders cards and the MobileFilterBar exposes the Filters trigger", async ({
  page,
}) => {
  await page.goto("/movies");

  // Both card and table render in the DOM (the table is CSS-hidden below lg);
  // the card list testid scopes us to the visible mobile rows.
  const cardList = page.getByTestId("media-card-list");
  await expect(cardList).toBeVisible({ timeout: 10_000 });
  await expect(cardList.getByText("The Missing Format")).toBeVisible();

  // MobileFilterBar is fixed at the bottom. The Only-missing pill was
  // removed (severity:"missing" is the canonical "no file" filter and
  // lives in the FilterSheet's Severity section now); the bar's only
  // trigger is the Filters sheet button.
  const filterBar = page.getByRole("toolbar", { name: /filter toolbar/i });
  await expect(filterBar).toBeVisible();
  await expect(
    filterBar.getByRole("button", { name: /^filters/i }),
  ).toBeVisible();
});
