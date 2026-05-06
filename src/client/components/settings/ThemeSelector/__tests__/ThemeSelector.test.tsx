// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import { act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  THEME_BRAND_KEY,
  THEME_MODE_KEY,
  setBrand as setRuntimeBrand,
} from "@/client/lib/theme";
import { renderWithProviders, screen } from "@/test/render";
import { ThemeSelector } from "../ThemeSelector";

describe("ThemeSelector", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("style");
    document.documentElement.classList.remove("dark", "theme-transition");
  });

  it("renders a card per brand and a segmented mode control", () => {
    renderWithProviders(<ThemeSelector />);
    const radioGroups = screen.getAllByRole("radiogroup");
    expect(radioGroups).toHaveLength(2);
    // Mode control: 3 radio buttons; Brand grid: 2
    const allRadios = screen.getAllByRole("radio");
    expect(allRadios).toHaveLength(5);
  });

  it("marks the active mode and brand as aria-checked", () => {
    localStorage.setItem(THEME_BRAND_KEY, "teal");
    localStorage.setItem(THEME_MODE_KEY, "light");
    renderWithProviders(<ThemeSelector />);
    expect(screen.getByRole("radio", { name: /^light$/i })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("radio", { name: /^teal/i })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("clicking a brand updates storage and keeps the current mode", async () => {
    localStorage.setItem(THEME_MODE_KEY, "light");
    renderWithProviders(<ThemeSelector />);
    await userEvent.click(screen.getByRole("radio", { name: /^teal/i }));
    expect(localStorage.getItem(THEME_BRAND_KEY)).toBe("teal");
    expect(localStorage.getItem(THEME_MODE_KEY)).toBe("light");
  });

  it("clicking a mode updates storage and keeps the current brand", async () => {
    localStorage.setItem(THEME_BRAND_KEY, "teal");
    renderWithProviders(<ThemeSelector />);
    await userEvent.click(screen.getByRole("radio", { name: /^dark$/i }));
    expect(localStorage.getItem(THEME_MODE_KEY)).toBe("dark");
    expect(localStorage.getItem(THEME_BRAND_KEY)).toBe("teal");
  });

  it("re-renders when an external setBrand fires the event", async () => {
    renderWithProviders(<ThemeSelector />);
    await act(async () => {
      setRuntimeBrand("teal");
    });
    expect(screen.getByRole("radio", { name: /^teal/i })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });
});
