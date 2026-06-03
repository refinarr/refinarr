import { test, expect } from "@playwright/test";
import { stubMediaApis } from "../phase4/mocks";

// QA-5 (#105) — Base UI <Select> triggers render as role="combobox" with NO
// text node, so without an explicit aria-label a screen reader announces an
// unlabeled button (axe `button-name`, critical). This regresses the Phase 4
// #40 lineage. Guard the accessible name directly via getByRole({ name }) —
// no axe dependency needed; a missing/renamed aria-label fails the role query.
//
// stubMediaApis seeds two instances so the /ignored instance filter (gated on
// instances.length > 1) renders.

test.use({ storageState: "e2e/.auth/user.json" });

test.beforeEach(async ({ page }) => {
  await stubMediaApis(page);
  // /logs pulls its own paginated feed; keep the page hermetic + fast.
  await page.route("**/api/logs**", (route) =>
    route.fulfill({
      status: 200,
      json: { items: [], page: 1, limit: 50, total: 0, totalPages: 0 },
    }),
  );
});

test("/logs Select filter triggers expose an accessible name", async ({
  page,
}) => {
  await page.goto("/logs");

  // Level + instance selects render regardless of log data / level threshold
  // (the source select is debug-gated, so it's not asserted here).
  await expect(
    page.getByRole("combobox", { name: /filter by level/i }),
  ).toBeVisible({ timeout: 10_000 });
  await expect(
    page.getByRole("combobox", { name: /filter by instance/i }),
  ).toBeVisible();
});

test("/ignored instance Select trigger exposes an accessible name", async ({
  page,
}) => {
  await page.route("**/api/ignore**", (route) =>
    route.fulfill({ status: 200, json: [] }),
  );
  await page.goto("/ignored");

  await expect(
    page.getByRole("combobox", { name: /select instance/i }),
  ).toBeVisible({ timeout: 10_000 });
});
