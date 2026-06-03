import { test, expect } from "@playwright/test";
import { stubMediaApis, movie, setDensity, DENSITY_SURFACES } from "./mocks";

// I3 — long / unicode / RTL titles render without breaking the layout in
// EVERY density (cozy/compact table, card, poster). The title truncates
// rather than forcing the page wider than the viewport.

test.use({
  storageState: "e2e/.auth/user.json",
  viewport: { width: 1280, height: 800 }, // desktop → all four densities apply
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

for (const surface of DENSITY_SURFACES) {
  test(`${surface.density}: long / unicode / RTL titles render without horizontal overflow`, async ({
    page,
  }) => {
    await page.goto("/movies");
    await setDensity(page, surface.density);
    await expect(page.getByTestId(surface.testid)).toBeVisible({
      timeout: 10_000,
    });

    // The text-bearing surfaces (table + card) render the full title in
    // the DOM (truncation is CSS-only). The poster grid shows it in the
    // tile caption, which may line-clamp — there we only assert layout.
    if (surface.testid !== "media-poster-grid") {
      for (const title of Object.values(TITLES)) {
        await expect(
          page.getByTestId(surface.testid).getByText(title),
        ).toBeVisible();
      }
    }

    // No horizontal overflow at the document level in any density.
    const overflows = await page.evaluate(() => {
      const el = document.documentElement;
      return el.scrollWidth > el.clientWidth + 1;
    });
    expect(overflows).toBe(false);
  });
}
