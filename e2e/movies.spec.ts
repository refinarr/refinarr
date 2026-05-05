import { test, expect } from "@playwright/test";
import type { PaginatedResponse } from "@/shared/types/api";
import type { FlaggedMovie } from "@/shared/types/models";

test.use({ storageState: "e2e/.auth/user.json" });

// Fake movie returned by the mocked /api/radarr/movies endpoint.
// The browser calls this Next.js route directly — mock it here, not /api/v3/*.
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

// Mock the instances list so the movies page has something to query.
const FAKE_INSTANCE = {
  id: 1,
  type: "radarr",
  name: "Mock Radarr",
  url: "http://192.168.1.100:7878",
  enabled: true,
  createdAt: new Date().toISOString(),
};

test.beforeEach(async ({ page }) => {
  // Mock the Next.js API routes (what the browser actually calls).
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

// Default chromium viewport is 1280x720 → md+; both the mobile card list and
// the desktop table render in the DOM, but the cards are CSS-hidden via md:hidden.
// Scope to the tbody testid so the locator only matches the visible desktop row.
test("flagged movies list renders", async ({ page }) => {
  await page.goto("/movies");
  await expect(
    page.getByTestId("media-table-body").getByText("The Missing Format"),
  ).toBeVisible({ timeout: 10_000 });
});

test("search by title filters results", async ({ page }) => {
  await page.goto("/movies");
  await page
    .getByTestId("media-table-body")
    .getByText("The Missing Format")
    .waitFor({ timeout: 10_000 });

  const searchInput = page.getByPlaceholder(/search/i);
  if (await searchInput.isVisible()) {
    await page.route("**/api/radarr/movies**", (route) =>
      route.fulfill({
        status: 200,
        json: { ...FAKE_RESPONSE, items: [], total: 0 },
      }),
    );
    await searchInput.fill("xyzzy nonexistent");
    await expect(page.getByText("The Missing Format")).toHaveCount(0, {
      timeout: 5_000,
    });
  }
});

test("search action in dry-run mode shows queued toast", async ({ page }) => {
  // Mock the search action with a dry-run ActionLog so the client's onSuccess
  // branches to the 'queued (dry run)' toast.
  await page.route("**/api/radarr/movies/search**", (route) =>
    route.fulfill({
      status: 200,
      json: {
        id: 1,
        instanceId: 1,
        action: "search",
        mediaId: 1,
        title: "The Missing Format",
        isDryRun: true,
        status: "dry_run",
        createdAt: new Date().toISOString(),
      },
    }),
  );

  await page.goto("/movies");
  await page
    .getByTestId("media-table-body")
    .getByText("The Missing Format")
    .waitFor({ timeout: 10_000 });

  const movieRow = page
    .getByTestId("media-table-body")
    .locator("tr")
    .filter({ hasText: "The Missing Format" });
  const searchBtn = movieRow.getByRole("button", { name: /search/i }).first();

  await searchBtn.click();
  await expect(page.getByText(/dry run|queued/i)).toBeVisible({
    timeout: 5_000,
  });
});
