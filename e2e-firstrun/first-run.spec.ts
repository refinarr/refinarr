import { test, expect } from "@playwright/test";

// Throwaway admin for the fresh container. Username must satisfy the setup
// form's pattern [a-zA-Z0-9_.-]+ (min 3 chars); password is min 12 chars.
const USERNAME = "firstrun_admin";
const PASSWORD = "FirstRun-Test-Pw-2026";

// Drives the real Docker image over plain HTTP through the new-deployment flow.
// This is the safety net for the deploy-layer bugs the regular e2e suite can't
// see (it runs `next start`, not the container): entrypoint + PUID/PGID, prisma
// migrate deploy, the standalone server, and — critically — the session cookie
// surviving a reload over HTTP (a Secure-flagged cookie is dropped by the
// browser on http://, which silently breaks login).
test.describe.serial("Docker image first run (plain HTTP)", () => {
  test("/setup creates the admin and the session survives a reload", async ({
    page,
  }) => {
    await page.goto("/setup");
    await expect(page.locator("#username")).toBeVisible();

    await page.locator("#username").fill(USERNAME);
    await page.locator("#password").fill(PASSWORD);
    await page.locator("#confirm").fill(PASSWORD);
    await page.locator('button[type="submit"]').click();

    await expect(page).toHaveURL(/\/dashboard/);

    // The crucial assertion: over plain HTTP a Secure cookie would be dropped,
    // bouncing us to /login. Staying on /dashboard proves the cookie persisted.
    await page.reload();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("login with the created admin survives a reload", async ({ page }) => {
    // A fresh test = a fresh browser context with no cookie, so this exercises
    // the /api/auth/login path (not just the setup-issued cookie).
    await page.goto("/login");
    await expect(page.locator("#username")).toBeVisible();

    await page.locator("#username").fill(USERNAME);
    await page.locator("#password").fill(PASSWORD);
    await page.locator('button[type="submit"]').click();

    await expect(page).toHaveURL(/\/dashboard/);
    await page.reload();
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
