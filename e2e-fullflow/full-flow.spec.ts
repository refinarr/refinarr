import { test, expect } from "@playwright/test";

// Full end-to-end journey against a REAL Sonarr/Radarr, driven through the real
// Docker image. Validates the server→*arr path the regular e2e suite stubs out:
// add instance → live connection test → real media list. Read-only + dry-run by
// design — the fresh container defaults dryRun=true, and this spec performs NO
// delete/search, so it never mutates your library.
//
// Provided by scripts/full-flow-test.sh via env:
const ARR_URL = process.env.ARR_URL ?? "";
const ARR_KEY = process.env.ARR_KEY ?? "";
const ARR_TYPE = (process.env.ARR_TYPE ?? "radarr").toLowerCase();
const INSTANCE_NAME = process.env.INSTANCE_NAME ?? "Full Flow Test";

const ADMIN_USER = "fullflow_admin";
const ADMIN_PASS = "FullFlow-Test-Pw-2026";

// Type-keyed lookups (no literal comparisons — matches the codebase convention).
const MEDIA_PATH: Record<string, string> = { radarr: "/movies", sonarr: "/shows" };
const TYPE_LABEL: Record<string, string> = { radarr: "Radarr", sonarr: "Sonarr" };
const mediaPath = MEDIA_PATH[ARR_TYPE] ?? MEDIA_PATH.radarr;
const typeLabel = TYPE_LABEL[ARR_TYPE] ?? TYPE_LABEL.radarr;

test.describe.serial("Full flow against a real *arr", () => {
  test.skip(
    !ARR_URL || !ARR_KEY,
    "ARR_URL and ARR_KEY must be set (see scripts/full-flow-test.sh)",
  );

  test("setup admin on the fresh container", async ({ page }) => {
    await page.goto("/setup");
    await expect(page.locator("#username")).toBeVisible();
    await page.locator("#username").fill(ADMIN_USER);
    await page.locator("#password").fill(ADMIN_PASS);
    await page.locator("#confirm").fill(ADMIN_PASS);
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("add the real instance and confirm the live connection test passes", async ({
    page,
  }) => {
    // Fresh context → log in first.
    await page.goto("/login");
    await page.locator("#username").fill(ADMIN_USER);
    await page.locator("#password").fill(ADMIN_PASS);
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto("/settings/instances");
    await page.getByRole("button", { name: "Add Instance" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Always set the type explicitly (selecting the default is harmless).
    await dialog.getByRole("combobox").click();
    await page.getByRole("option", { name: typeLabel }).click();

    await dialog.getByLabel("Name", { exact: true }).fill(INSTANCE_NAME);
    await dialog.getByLabel("URL", { exact: true }).fill(ARR_URL);
    await dialog.getByLabel("API Key").fill(ARR_KEY);
    await dialog.getByRole("button", { name: "Save" }).click();

    // The decisive real-path assertion: the connection test (refinarr server →
    // your *arr) succeeded. Proves reachability + API key + URL guard end-to-end.
    await expect(page.getByText(`${INSTANCE_NAME}: connected`)).toBeVisible({
      timeout: 20_000,
    });
  });

  test("real media list loads (flagged items or a valid empty state)", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.locator("#username").fill(ADMIN_USER);
    await page.locator("#password").fill(ADMIN_PASS);
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto(mediaPath);

    // Real libraries vary, so this is a soft check: the page must settle into a
    // real state — the media table OR a legitimate empty/all-clear state — and
    // must NOT show an error. We don't assert specific titles or counts.
    await expect(
      page
        .getByTestId("media-table-body")
        .or(page.getByText(/all clear|no .*match|nothing|add .*instance/i)),
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/something went wrong|failed to load/i)).toHaveCount(
      0,
    );

    // Session still valid after a reload (cookie persisted over HTTP).
    await page.reload();
    await expect(page).toHaveURL(new RegExp(mediaPath));
  });
});
