import { test, expect } from "@playwright/test";
import type { PaginatedResponse } from "@/shared/types/api";
import type { FlaggedMovie } from "@/shared/types/models";

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

const FAKE_MOVIE: FlaggedMovie = {
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
};

const FAKE_RESPONSE: PaginatedResponse<FlaggedMovie> = {
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
    route.fulfill({ status: 200, json: FAKE_RESPONSE })
  );
  await page.route("**/api/radarr/qualityprofiles**", (route) =>
    route.fulfill({ status: 200, json: [] })
  );
  await page.route("**/api/preferences**", (route) =>
    route.fulfill({ status: 200, json: [] })
  );
});

test("topbar hamburger replaces the sidebar on mobile and opens the nav sheet", async ({ page }) => {
  await page.goto("/dashboard");
  // The desktop sidebar is hidden below md, and the dashboard nav links
  // are not in the DOM until the sheet opens.
  await expect(page.getByRole("link", { name: /movies/i })).toHaveCount(0);

  await page.getByRole("button", { name: /open navigation menu/i }).click();
  await expect(page.getByRole("link", { name: /movies/i })).toBeVisible({ timeout: 5_000 });
  await expect(page.getByRole("link", { name: /shows/i })).toBeVisible();
});

test("movies page renders cards and the filter pills are visible on mobile", async ({ page }) => {
  await page.goto("/movies");

  // Both card and table render in the DOM (the table is CSS-hidden below lg);
  // the card list testid scopes us to the visible mobile rows.
  const cardList = page.getByTestId("media-card-list");
  await expect(cardList).toBeVisible({ timeout: 10_000 });
  await expect(cardList.getByText("The Missing Format")).toBeVisible();

  // Filter pills wrap naturally on mobile — no separate sheet trigger.
  // The Only-missing toggle is the always-visible quick filter.
  await expect(page.getByRole("button", { name: /only missing/i })).toBeVisible();
});

test("only-missing pill toggles to active state when tapped", async ({ page }) => {
  await page.goto("/movies");
  await page
    .getByTestId("media-card-list")
    .getByText("The Missing Format")
    .waitFor({ timeout: 10_000 });

  const toggle = page.getByRole("button", { name: /only missing/i });
  await toggle.click();
  // After tapping, a "Clear all" link appears since at least one filter is now active.
  await expect(page.getByRole("button", { name: /clear all/i })).toBeVisible({ timeout: 5_000 });
});
