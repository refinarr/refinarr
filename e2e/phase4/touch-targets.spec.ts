import { test, expect } from "@playwright/test";
import { stubMediaApis } from "./mocks";

// A12 — the mobile bottom nav, the primary touch surface, meets the 44px
// minimum tap-target size (the #84 fix; pointer-coarse:min-h-11). hasTouch
// makes `pointer: coarse` match so those rules apply.

test.use({
  storageState: "e2e/.auth/user.json",
  viewport: { width: 393, height: 852 },
  hasTouch: true,
});

const MIN_TAP_PX = 44;

test.beforeEach(async ({ page }) => {
  await stubMediaApis(page);
});

test("mobile tab-bar nav targets are at least 44px tall", async ({ page }) => {
  await page.goto("/dashboard");

  const tabBar = page.getByRole("navigation", { name: /primary navigation/i });
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
