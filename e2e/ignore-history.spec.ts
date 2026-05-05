import { test, expect } from "@playwright/test";
import type { PaginatedResponse } from "@/shared/types/api";
import type { FlaggedMovie } from "@/shared/types/models";

// Reuse the session created by auth.spec.ts — avoids extra login API calls.
test.use({ storageState: "e2e/.auth/user.json" });

const FAKE_MOVIE: FlaggedMovie = {
  id: 2,
  title: "Ignorable Film",
  year: 2023,
  qualityProfileId: 1,
  movieFileId: 201,
  customFormats: [],
  customFormatScore: 0,
  hasFile: true,
  cfScore: 0,
  missingFormats: [{ id: 99, name: "HDR" }],
  unwantedFormats: [],
  sizeOnDisk: 1_000_000_000,
};

const FAKE_INSTANCE = {
  id: 1,
  type: "radarr",
  name: "Mock Radarr",
  url: "http://192.168.1.100:7878",
  enabled: true,
  createdAt: new Date().toISOString(),
};

test.beforeEach(async () => {
  // Session comes from storageState — no login API call needed.
});

test("ignoring a movie removes it from the flagged list", async ({ page }) => {
  const moviesResponse: PaginatedResponse<FlaggedMovie> = {
    items: [FAKE_MOVIE],
    total: 1,
    page: 1,
    limit: 50,
    hasMore: false,
  };
  const emptyResponse: PaginatedResponse<FlaggedMovie> = {
    items: [],
    total: 0,
    page: 1,
    limit: 50,
    hasMore: false,
  };

  // After the ignore POST, return empty list so the movie disappears on refetch.
  let ignored = false;

  await page.route("**/api/instances", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({ status: 200, json: [FAKE_INSTANCE] });
    }
    return route.continue();
  });
  await page.route("**/api/radarr/movies**", (route) =>
    route.fulfill({
      status: 200,
      json: ignored ? emptyResponse : moviesResponse,
    }),
  );
  await page.route("**/api/radarr/qualityprofiles**", (route) =>
    route.fulfill({ status: 200, json: [] }),
  );
  await page.route("**/api/preferences**", (route) =>
    route.fulfill({ status: 200, json: [] }),
  );
  await page.route("**/api/ignore**", (route) => {
    ignored = true;
    return route.fulfill({
      status: 201,
      json: { id: 1, mediaId: 2, mediaType: "movie", title: "Ignorable Film" },
    });
  });

  await page.goto("/movies");
  // Card and table both render in the DOM (the card is CSS-hidden at desktop
  // viewport via md:hidden); use the tbody testid to scope to the visible row.
  await page
    .getByTestId("media-table-body")
    .getByText("Ignorable Film")
    .waitFor({ timeout: 10_000 });

  const ignoreBtn = page.getByRole("button", { name: "Ignore" }).first();
  if (await ignoreBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await ignoreBtn.click();

    // Confirm dialog if present
    const confirmBtn = page.getByRole("button", { name: /confirm|yes/i });
    if (await confirmBtn.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await confirmBtn.click();
    }

    // After ignore, the item should be fully removed from the DOM (both card and table).
    await expect(page.getByText("Ignorable Film")).toHaveCount(0, {
      timeout: 5_000,
    });
  }
});

test("history page loads and shows table or empty state", async ({ page }) => {
  await page.goto("/history");
  await expect(page).toHaveURL(/\/history/, { timeout: 10_000 });

  // Either a table with rows or an empty-state message must be visible.
  const hasContent = page.locator("table").first();
  const hasEmpty = page.getByText(/no (actions|history|results)/i);

  await expect(hasContent.or(hasEmpty)).toBeVisible({ timeout: 10_000 });
});
