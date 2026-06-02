import { test, expect } from "@playwright/test";
import { stubMediaApis, movie } from "./mocks";

// I3 — long / unicode / RTL titles render without breaking the layout
// (the card title truncates rather than forcing horizontal overflow).

test.use({
  storageState: "e2e/.auth/user.json",
  viewport: { width: 393, height: 852 }, // mobile → always the card list
});

const TITLES = {
  long: "The Exceptionally and Unreasonably Long Motion Picture Title That Simply Refuses to End No Matter What",
  unicode: "日本語のタイトル 🎬 émojî",
  rtl: "العنوان الطويل جدا لفيلم باللغة العربية",
};

test.beforeEach(async ({ page }) => {
  await stubMediaApis(page, {
    movies: [
      movie({ id: 1, title: TITLES.long }),
      movie({ id: 2, title: TITLES.unicode }),
      movie({ id: 3, title: TITLES.rtl }),
    ],
  });
});

test("long / unicode / RTL titles render without horizontal overflow", async ({
  page,
}) => {
  await page.goto("/movies");

  const cardList = page.getByTestId("media-card-list");
  await expect(cardList).toBeVisible({ timeout: 10_000 });

  // Full title text is present in the DOM (truncation is CSS-only).
  for (const title of Object.values(TITLES)) {
    await expect(cardList.getByText(title)).toBeVisible();
  }

  // No horizontal overflow at the document level — the long title must
  // truncate, not push the page wider than the viewport.
  const overflows = await page.evaluate(() => {
    const el = document.documentElement;
    return el.scrollWidth > el.clientWidth + 1;
  });
  expect(overflows).toBe(false);
});
