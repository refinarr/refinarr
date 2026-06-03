import { test, expect } from "@playwright/test";
import { stubMediaApis, movie } from "./mocks";

// I8 — the mobile filter sheet survives an orientation change: open it in
// portrait, rotate to landscape, and it stays usable (no crash / no stuck
// overlay) and still closes cleanly.

test.use({
  storageState: "e2e/.auth/user.json",
  viewport: { width: 393, height: 852 }, // mobile portrait
  hasTouch: true,
});

test.beforeEach(async ({ page }) => {
  await stubMediaApis(page, { movies: [movie()] });
});

test("I8: filter sheet stays usable across a portrait → landscape rotation", async ({
  page,
}) => {
  await page.goto("/movies");

  // Open the bottom filter bar's sheet.
  const filterToolbar = page.getByRole("toolbar", { name: /filter toolbar/i });
  await expect(filterToolbar).toBeVisible({ timeout: 10_000 });
  await filterToolbar.getByRole("button", { name: /filters/i }).click();

  const sheet = page.getByRole("dialog");
  await expect(sheet).toBeVisible({ timeout: 5_000 });
  await expect(sheet.getByText(/toggle filters/i)).toBeVisible();

  // Rotate to landscape — the sheet must remain mounted and interactable.
  await page.setViewportSize({ width: 852, height: 393 });
  await expect(sheet).toBeVisible();
  // A section heading still renders (layout didn't collapse).
  await expect(sheet.getByRole("heading", { name: /severity/i })).toBeVisible();

  // Closes cleanly after the rotation.
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden({ timeout: 5_000 });
});
