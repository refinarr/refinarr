import { test, expect } from "@playwright/test";
import { stubMediaApis } from "./mocks";

// A11 — the command palette (Cmd/Ctrl+K) can reach every primary
// destination. Instances of both arr types are stubbed so the Movies and
// Shows entries render (they're gated on a configured arr type).

test.use({ storageState: "e2e/.auth/user.json" });

test.beforeEach(async ({ page }) => {
  await stubMediaApis(page);
});

const TARGETS = [
  { label: "Dashboard", url: /\/dashboard/ },
  { label: "Movies", url: /\/movies/ },
  { label: "Shows", url: /\/shows/ },
  { label: "History", url: /\/history/ },
  { label: "Logs", url: /\/logs/ },
  { label: "Settings", url: /\/settings/ },
];

test("command palette reaches all 6 primary nav targets", async ({ page }) => {
  await page.goto("/dashboard");

  for (const { label, url } of TARGETS) {
    await page.keyboard.press("ControlOrMeta+k");
    const input = page.getByPlaceholder(/type a command/i);
    await expect(input).toBeVisible({ timeout: 5_000 });

    await input.fill(label);
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(url, { timeout: 5_000 });
    await expect(input).toBeHidden();
  }
});
