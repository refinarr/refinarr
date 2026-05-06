// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, beforeAll } from "vitest";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, screen } from "@/test/render";
import { THEME_BRAND_KEY, THEME_MODE_KEY } from "@/client/lib/theme";
import { ThemeToggle } from "../ThemeToggle";

describe("ThemeToggle", () => {
  beforeAll(() => {
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.releasePointerCapture = () => {};
    Element.prototype.scrollIntoView = () => {};
  });

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("style");
    document.documentElement.classList.remove("dark", "theme-transition");
  });

  it("renders a labelled trigger button", () => {
    renderWithProviders(<ThemeToggle />);
    expect(
      screen.getByRole("button", { name: /change theme/i }),
    ).toBeInTheDocument();
  });

  it("opens the menu and switches mode without changing brand", async () => {
    const user = userEvent.setup();
    localStorage.setItem(THEME_BRAND_KEY, "teal");
    localStorage.setItem(THEME_MODE_KEY, "dark");
    renderWithProviders(<ThemeToggle />);

    const trigger = screen.getByRole("button", { name: /change theme/i });
    trigger.focus();
    await user.keyboard("[Enter]");

    const items = await screen.findAllByRole("menuitem");
    // 3 modes (Light/Dark/System) + 2 brands (Amber/Teal)
    expect(items).toHaveLength(5);

    const lightMode = items.find((el) => el.textContent?.trim() === "Light");
    expect(lightMode).toBeDefined();
    await user.click(lightMode!);

    expect(localStorage.getItem(THEME_MODE_KEY)).toBe("light");
    expect(localStorage.getItem(THEME_BRAND_KEY)).toBe("teal");
  });

  it("brand pick keeps the current mode", async () => {
    const user = userEvent.setup();
    localStorage.setItem(THEME_BRAND_KEY, "amber");
    localStorage.setItem(THEME_MODE_KEY, "light");
    renderWithProviders(<ThemeToggle />);

    const trigger = screen.getByRole("button", { name: /change theme/i });
    trigger.focus();
    await user.keyboard("[Enter]");

    const items = await screen.findAllByRole("menuitem");
    const tealItem = items.find((el) => el.textContent?.trim() === "Teal");
    expect(tealItem).toBeDefined();
    await user.click(tealItem!);

    expect(localStorage.getItem(THEME_BRAND_KEY)).toBe("teal");
    expect(localStorage.getItem(THEME_MODE_KEY)).toBe("light");
  });
});
