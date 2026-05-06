// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import { renderWithProviders, screen } from "@/test/render";
import { TopHeader } from "../TopHeader";

vi.mock("@/client/hooks/data/useHealth", () => ({
  useHealth: () => ({ data: { status: "ok" }, isError: false }),
}));

describe("TopHeader", () => {
  it("renders a labelled hamburger that calls onToggleSidebar", async () => {
    const onToggle = vi.fn();
    renderWithProviders(<TopHeader onToggleSidebar={onToggle} />);
    const button = screen.getByRole("button", {
      name: /open navigation menu/i,
    });
    button.click();
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("renders the theme toggle on the right", () => {
    renderWithProviders(<TopHeader onToggleSidebar={() => {}} />);
    expect(
      screen.getByRole("button", { name: /change theme/i }),
    ).toBeInTheDocument();
  });
});
