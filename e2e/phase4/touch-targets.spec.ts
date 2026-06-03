import { test, expect } from "@playwright/test";
import { stubMediaApis, movie, setDensity } from "./mocks";

// A12 / QA-4 (#94) — touch targets meet the 44px minimum:
//   - the mobile bottom nav (primary touch surface)
//   - the per-item selection checkbox on the card AND poster surfaces
//     (the size-4 checkbox + its after:-inset hit-expander only reach
//     ~32px tall; the wrapping pill bumps to 44px on a coarse pointer).
// hasTouch makes `pointer: coarse` match so those rules apply.

const MIN_TAP_PX = 44;

test.describe("A12 — mobile bottom nav", () => {
  test.use({
    storageState: "e2e/.auth/user.json",
    viewport: { width: 393, height: 852 },
    hasTouch: true,
  });

  test.beforeEach(async ({ page }) => {
    await stubMediaApis(page);
  });

  test("mobile tab-bar nav targets are at least 44px tall", async ({
    page,
  }) => {
    await page.goto("/dashboard");

    const tabBar = page.getByRole("navigation", {
      name: /primary navigation/i,
    });
    await expect(tabBar).toBeVisible({ timeout: 5_000 });

    const targets = [
      ...(await tabBar.getByRole("link").all()),
      tabBar.getByRole("button", { name: /open more menu/i }),
    ];
    expect(targets.length).toBeGreaterThan(1);

    for (const target of targets) {
      const box = await target.boundingBox();
      expect(box).not.toBeNull();
      // Sub-pixel tolerance — 44px tokens can measure 43.99 after layout.
      expect(box!.height).toBeGreaterThanOrEqual(MIN_TAP_PX - 0.5);
    }
  });
});

test.describe("QA-4 (#94) — selection checkbox tap target", () => {
  // Coarse pointer on a desktop viewport so the card / poster densities
  // both render (mobile collapses them to the card list).
  test.use({
    storageState: "e2e/.auth/user.json",
    viewport: { width: 1024, height: 800 },
    hasTouch: true,
  });

  test.beforeEach(async ({ page }) => {
    await stubMediaApis(page, {
      movies: [movie({ id: 1 }), movie({ id: 2, title: "Second" })],
    });
  });

  for (const surface of [
    { density: "card", testid: "media-card-list" },
    { density: "poster", testid: "media-poster-grid" },
  ]) {
    test(`${surface.density}: selection checkbox is at least 44px`, async ({
      page,
    }) => {
      await page.goto("/movies");
      await setDensity(page, surface.density);
      await expect(page.getByTestId(surface.testid)).toBeVisible({
        timeout: 10_000,
      });

      const targets = await page.getByTestId("media-select-target").all();
      expect(targets.length).toBeGreaterThan(0);
      for (const target of targets) {
        const box = await target.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.height).toBeGreaterThanOrEqual(MIN_TAP_PX - 0.5);
        expect(box!.width).toBeGreaterThanOrEqual(MIN_TAP_PX - 0.5);
      }
    });
  }
});
