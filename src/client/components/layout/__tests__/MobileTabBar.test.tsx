// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from "vitest";
import { fireEvent } from "@testing-library/react";
import { renderWithProviders, screen } from "@/test/render";
import { MobileTabBar } from "../MobileTabBar";

let mockPathname = "/movies";
const mockReplace = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ replace: mockReplace, push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
}));

// MobileInstanceTab (rendered by MobileTabBar on /movies + /shows)
// calls useInstances; stub it so the test doesn't hit MSW's
// unhandled-request error and stay deterministic across runs.
vi.mock("@/client/hooks/data/useInstances", () => ({
  useInstances: () => ({ data: [] }),
  useInstanceHealth: () => ({ data: undefined, isLoading: true }),
  // No instances yet → onboarding fallback shows all arr tabs (#53), so
  // the existing Movies + Shows assertions still hold.
  useConfiguredArrTypes: () => ["radarr", "sonarr"],
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

  describe("Instance tab presence by route", () => {
    afterEach(() => {
      mockPathname = "/movies";
    });

    it("does not render the Instance tab on /dashboard", () => {
      mockPathname = "/dashboard";
      renderWithProviders(
        <MobileTabBar onMoreClick={() => {}} moreOpen={false} />,
      );
      // No instances loaded in the test (useInstances returns undefined)
      // → MobileInstanceTab returns null on /movies + /shows too. But the
      // wrapping condition itself should not render the component at all
      // on /dashboard. We can't assert by absence of a render — we assert
      // that the only buttons in the bar are the More button.
      expect(screen.getAllByRole("button")).toHaveLength(1);
    });

    it("renders nothing for the Instance tab while instances are loading", () => {
      // /movies path is the default. MobileInstanceTab returns null when
      // useInstances has no data yet → only the More button + 3 nav links
      // are visible.
      renderWithProviders(
        <MobileTabBar onMoreClick={() => {}} moreOpen={false} />,
      );
      expect(screen.getAllByRole("link")).toHaveLength(3);
      expect(screen.getAllByRole("button")).toHaveLength(1);
    });
  });
});
