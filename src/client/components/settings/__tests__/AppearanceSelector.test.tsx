// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, screen } from "@/test/render";

const setTheme = vi.fn();
let currentTheme = "dark-orange";

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: currentTheme, setTheme }),
}));

import { AppearanceSelector } from "../AppearanceSelector";

describe("AppearanceSelector", () => {
  beforeEach(() => {
    setTheme.mockReset();
    currentTheme = "dark-orange";
  });

  it("renders one selectable card per theme", () => {
    renderWithProviders(<AppearanceSelector />);
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(3);
  });

  it("marks the current theme aria-checked", () => {
    renderWithProviders(<AppearanceSelector />);
    const orange = screen.getByRole("radio", { name: /dark.*orange/i });
    expect(orange).toHaveAttribute("aria-checked", "true");
    const teal = screen.getByRole("radio", { name: /dark.*teal/i });
    expect(teal).toHaveAttribute("aria-checked", "false");
  });

  it("calls setTheme with the chosen theme on click", async () => {
    renderWithProviders(<AppearanceSelector />);
    await userEvent.click(screen.getByRole("radio", { name: /dark.*teal/i }));
    expect(setTheme).toHaveBeenCalledWith("dark-teal");
  });
});
