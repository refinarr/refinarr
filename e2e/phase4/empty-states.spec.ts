import { test, expect } from "@playwright/test";
import { stubMediaApis } from "./mocks";

// I1 — a search that matches nothing surfaces the "no filter match" empty
// state (not a blank list). The media APIs return zero items; typing a
// query adds a filter chip, which flips the page to the filtered-empty
// state (vs the no-query "all clear" state).

test.use({ storageState: "e2e/.auth/user.json" });

test.beforeEach(async ({ page }) => {
  await stubMediaApis(page); // movies + series both empty
});

async function expectNoMatchAfterSearch(
  page: import("@playwright/test").Page,
  route: string,
): Promise<void> {
  await page.goto(route);
  const search = page.getByPlaceholder(/search title or custom format/i);
  await expect(search.first()).toBeVisible({ timeout: 10_000 });
  await search.first().fill("zzz-no-such-title");
  await expect(page.getByTestId("empty-no-filter-match")).toBeVisible({
    timeout: 10_000,
  });
}

test("movies: no-match search shows the filtered-empty state", async ({
  page,
}) => {
  await expectNoMatchAfterSearch(page, "/movies");
});

test("shows: no-match search shows the filtered-empty state", async ({
  page,
}) => {
  await expectNoMatchAfterSearch(page, "/shows");
});
