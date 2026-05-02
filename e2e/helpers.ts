import type { Page } from "@playwright/test";

// Fixed credentials used throughout E2E tests.
// The auth spec creates this account on the fresh test DB at the start of each run.
export const E2E_USERNAME = "e2e-admin";
export const E2E_PASSWORD = "E2eTestPassword123!";

export async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Username").fill(E2E_USERNAME);
  await page.getByLabel("Password", { exact: true }).fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 10_000 });
}
