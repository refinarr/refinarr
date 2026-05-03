import { test, expect } from "@playwright/test";
import { E2E_USERNAME, E2E_PASSWORD } from "./helpers";

// The fresh-DB redirect + setup-flow tests live in auth.setup.ts (a Playwright
// setup project). These tests assume the E2E admin account already exists.

test("visiting /setup after setup redirects to /dashboard", async ({ page }) => {
  // Log in first so the proxy doesn't bounce us to /login before checking setup state.
  await page.goto("/login");
  await page.getByLabel("Username").fill(E2E_USERNAME);
  await page.getByLabel("Password", { exact: true }).fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });

  await page.goto("/setup");
  await expect(page).toHaveURL(/\/dashboard/);
});

test("wrong password shows error and stays on /login", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Username").fill(E2E_USERNAME);
  await page.getByLabel("Password", { exact: true }).fill("definitelyWrongPassword999!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByText("Invalid username or password")).toBeVisible();
});

test("correct credentials redirect to /dashboard", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Username").fill(E2E_USERNAME);
  await page.getByLabel("Password", { exact: true }).fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
});

test("logout redirects to /login", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Username").fill(E2E_USERNAME);
  await page.getByLabel("Password", { exact: true }).fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);
});
