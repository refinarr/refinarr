// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import { renderWithProviders, screen } from "@/test/render";
import { MobileTabBar } from "../MobileTabBar";

vi.mock("next/navigation", () => ({
  usePathname: () => "/movies",
}));

describe("MobileTabBar", () => {
  it("renders Dashboard / Movies / Shows links plus a More button", () => {
    renderWithProviders(
      <MobileTabBar onMoreClick={() => {}} moreOpen={false} />,
    );
    expect(screen.getByRole("link", { name: /dashboard/i })).toHaveAttribute(
      "href",
      "/dashboard",
    );
    expect(screen.getByRole("link", { name: /movies/i })).toHaveAttribute(
      "href",
      "/movies",
    );
    expect(screen.getByRole("link", { name: /shows/i })).toHaveAttribute(
      "href",
      "/shows",
    );
    expect(
      screen.getByRole("button", { name: /open more menu/i }),
    ).toBeInTheDocument();
  });

  it("marks the link matching the current pathname with aria-current=page", () => {
    renderWithProviders(
      <MobileTabBar onMoreClick={() => {}} moreOpen={false} />,
    );
    const movies = screen.getByRole("link", { name: /movies/i });
    expect(movies).toHaveAttribute("aria-current", "page");
    const dashboard = screen.getByRole("link", { name: /dashboard/i });
    expect(dashboard).not.toHaveAttribute("aria-current");
  });

  it("calls onMoreClick when the More button is tapped", () => {
    const onMoreClick = vi.fn();
    renderWithProviders(
      <MobileTabBar onMoreClick={onMoreClick} moreOpen={false} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /open more menu/i }));
    expect(onMoreClick).toHaveBeenCalledTimes(1);
  });

  it("reflects More open state via aria-expanded", () => {
    const { rerender } = renderWithProviders(
      <MobileTabBar onMoreClick={() => {}} moreOpen={false} />,
    );
    expect(
      screen.getByRole("button", { name: /open more menu/i }),
    ).toHaveAttribute("aria-expanded", "false");
    rerender(<MobileTabBar onMoreClick={() => {}} moreOpen={true} />);
    expect(
      screen.getByRole("button", { name: /open more menu/i }),
    ).toHaveAttribute("aria-expanded", "true");
  });
});
