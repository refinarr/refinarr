import { test, expect } from "@playwright/test";
import { stubMediaApis, movie } from "./mocks";

// I5 — density, brand, and mode survive a reload (read from localStorage
// on the next paint, not reset to defaults).

test.use({ storageState: "e2e/.auth/user.json" });

test.beforeEach(async ({ page }) => {
  await stubMediaApis(page, { movies: [movie()] });
});

test("density=card persists across reload", async ({ page }) => {
  await page.goto("/movies");
  await page.evaluate(() => localStorage.setItem("rfn-density", "card"));
  await page.reload();

  // On desktop, card density renders the MediaCardList (vs the table).
  await expect(page.getByTestId("media-card-list")).toBeVisible({
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
