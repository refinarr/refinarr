import { test, expect } from "@playwright/test";
import { stubMediaApis, movie, setDensity } from "./mocks";

// #128 — in desktop poster mode the table column-header funnels aren't
// available, so the top bar exposes a Filters popover (the shared
// FilterFunnelStack) + a Sort menu. These guard that the controls (a) show
// ONLY in poster, (b) actually mutate the shared filter/sort state — the
// behaviour the testids were added for but no test exercised.
test.describe("QA — poster desktop filter + sort controls (#128)", () => {
  test.use({
    storageState: "e2e/.auth/user.json",
    viewport: { width: 1024, height: 800 },
  });

  test.beforeEach(async ({ page }) => {
    await stubMediaApis(page, {
      movies: [
        movie({ id: 1, title: "Alpha" }),
        movie({ id: 2, title: "Bravo" }),
      ],
    });
  });

  test("controls render only in poster density, not in the table densities", async ({
    page,
  }) => {
    await page.goto("/movies");
    await setDensity(page, "cozy");
    await expect(page.getByTestId("media-table-body")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByTestId("poster-desktop-controls")).toBeHidden();

    await setDensity(page, "poster");
    await expect(page.getByTestId("media-poster-grid")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByTestId("poster-desktop-controls")).toBeVisible();
  });

  test("Filters popover applies an axis and surfaces the active count", async ({
    page,
  }) => {
    await page.goto("/movies");
    await setDensity(page, "poster");
    await expect(page.getByTestId("media-poster-grid")).toBeVisible({
      timeout: 10_000,
    });

    const trigger = page.getByTestId("poster-filter-trigger");
    await expect(trigger).not.toContainText("1");
    await trigger.click();

    // Popover open → toggle a single axis (monitor status).
    const monitored = page.getByRole("button", {
      name: "Monitored",
      exact: true,
    });
    await expect(monitored).toBeVisible({ timeout: 5_000 });
    await monitored.click();
    await expect(monitored).toHaveAttribute("aria-pressed", "true");

    // The trigger now shows the active-filter count, and a removable chip
    // appears in the active-filter strip (state reached the shared filters).
    await expect(trigger).toContainText("1");
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: /remove/i }).first(),
    ).toBeVisible();
  });

  test("Sort menu changes the active sort key, reflected on the trigger", async ({
    page,
  }) => {
    await page.goto("/movies");
    await setDensity(page, "poster");
    await expect(page.getByTestId("media-poster-grid")).toBeVisible({
      timeout: 10_000,
    });

    const sortTrigger = page.getByTestId("poster-sort-trigger");
    await expect(sortTrigger).toContainText("Score"); // default sortBy
    await sortTrigger.click();
    await page.getByRole("menuitemradio", { name: "Title" }).click();
    await expect(sortTrigger).toContainText("Title");
  });
});
