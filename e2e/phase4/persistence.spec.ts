import { test, expect } from "@playwright/test";
import {
  stubMediaApis,
  movie,
  series,
  setDensity,
  DENSITY_SURFACES,
} from "./mocks";

// I5 — density, brand, and mode survive a reload (read from localStorage
// on the next paint, not reset to defaults), in every density and across
// pages.

test.use({
  storageState: "e2e/.auth/user.json",
  viewport: { width: 1280, height: 800 }, // desktop → the table/poster densities apply
});

test.beforeEach(async ({ page }) => {
  await stubMediaApis(page, { movies: [movie()], series: [series()] });
});

for (const surface of DENSITY_SURFACES) {
  test(`density=${surface.density} persists across reload`, async ({
    page,
  }) => {
    await page.goto("/movies");
    await setDensity(page, surface.density);
    await expect(page.getByTestId(surface.testid)).toBeVisible({
      timeout: 10_000,
    });
  });
}

// #129 — "card" is no longer a desktop view. A previously-stored "card"
// density must degrade gracefully to the cozy table on desktop (not get
// the user stuck on a removed mode or a blank surface).
test("a stored 'card' density falls back to the cozy table on desktop", async ({
  page,
}) => {
  await page.goto("/movies");
  await setDensity(page, "card");
  await expect(page.getByTestId("media-table-body")).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByTestId("media-card-list")).toBeHidden();
});

test("density persists across pages (movies → shows)", async ({ page }) => {
  await page.goto("/movies");
  await setDensity(page, "poster");
  await expect(page.getByTestId("media-poster-grid")).toBeVisible({
    timeout: 10_000,
  });

  await page.goto("/shows");
  // Same global density applies on the shows page without re-selecting.
  await expect(page.getByTestId("media-poster-grid")).toBeVisible({
    timeout: 10_000,
  });
});

test("brand + dark mode persist across reload", async ({ page }) => {
  await page.goto("/movies");
  await page.evaluate(() => {
    localStorage.setItem("rfn-brand", "teal");
    localStorage.setItem("rfn-mode", "dark");
  });
  await page.reload();

  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-theme", "teal", { timeout: 10_000 });
  await expect(html).toHaveClass(/dark/);
});
