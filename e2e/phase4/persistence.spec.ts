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
  viewport: { width: 1280, height: 800 }, // desktop → all four densities apply
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
