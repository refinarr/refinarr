import { test, expect } from "@playwright/test";

test.use({ storageState: "e2e/.auth/user.json" });

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  await page.goto("/settings");
});

test("settings page renders Add Instance button", async ({ page }) => {
  await expect(
    page.getByRole("button", { name: "Add Instance" }),
  ).toBeVisible();
});

test("add a Radarr instance and verify card appears", async ({ page }) => {
  // Intercept the connection-test call that fires on save (POST /api/instances/{id}/test
  // is server → Radarr, but the save itself is POST /api/instances which we let through).
  // The instance card will appear even if the Radarr host is unreachable.
  await page.getByRole("button", { name: "Add Instance" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  await dialog.getByLabel("Name", { exact: true }).fill("E2E Test Radarr");
  await dialog
    .getByLabel("URL", { exact: true })
    .fill("http://192.168.1.100:7878");
  await dialog.getByLabel("API Key").fill("deadbeef1234567890abcdef12345678");
  await dialog.getByRole("button", { name: "Save" }).click();

  // First match is the card — a toast may also contain the name momentarily.
  await expect(page.getByText("E2E Test Radarr").first()).toBeVisible({
    timeout: 10_000,
  });
});

test("delete the E2E instance removes it from the list", async ({ page }) => {
  const card = page
    .locator('[data-slot="card"]')
    .filter({ hasText: "E2E Test Radarr" });
  await expect(card).toBeVisible({ timeout: 5_000 });

  await card.getByRole("button", { name: "Delete" }).click();

  await expect(card).not.toBeVisible({ timeout: 10_000 });
});
