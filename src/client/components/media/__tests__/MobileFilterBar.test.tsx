// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import type { MediaFilters } from "@/client/hooks/media/useMediaFilters";
import { renderWithProviders, screen } from "@/test/render";

// ─────────────────────────────────────────────────────────────────────
// Mocks — drive scroll direction + reduced-motion deterministically.
// FilterSheet is replaced with a thin probe so this test stays focused
// on the bar and doesn't pull in dialog/portal machinery.

let mockDirection: "up" | "down" | null = null;
let mockReducedMotion = false;

vi.mock("@/client/hooks/ui/useScrollDirection", () => ({
  useScrollDirection: () => mockDirection,
}));

vi.mock("@/client/hooks/ui/useMediaQuery", () => ({
  useMediaQuery: () => false,
  useIsDesktop: () => false,
  usePrefersReducedMotion: () => mockReducedMotion,
}));

vi.mock("../FilterSheet", () => ({
  FilterSheet: ({ open }: { open: boolean }) => (
    <div data-testid="filter-sheet" data-open={open ? "true" : "false"} />
  ),
}));

import { MobileFilterBar } from "../MobileFilterBar";

const baseFilters: MediaFilters = {
  sortBy: "score",
  order: "asc",
  minScore: null,
  maxScore: null,
  minSize: null,
  maxSize: null,
  q: "",
  mediaId: null,
  profileIds: [],
  severities: [],
  missingCfIds: [],
  missingCfMatch: "all",
  hasNegativeCfIds: [],
  hasNegativeCfMatch: "all",
  flaggedOnly: true,
  monitorStatus: "all",
};

const baseProps = {
  scoringMode: "manual" as const,
  profiles: undefined,
  cfOptions: { missing: [], penalty: [] },
  filters: baseFilters,
  onChange: vi.fn(),
};

beforeEach(() => {
  mockDirection = null;
  mockReducedMotion = false;
});

describe("MobileFilterBar — base rendering", () => {
  it("renders the Filters trigger", () => {
    renderWithProviders(<MobileFilterBar {...baseProps} onChange={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: /filters/i }),
    ).toBeInTheDocument();
  });

  it("shows the active-axis badge count when sheet-managed filters are set", () => {
    renderWithProviders(
      <MobileFilterBar
        {...baseProps}
        filters={{
          ...baseFilters,
          profileIds: [1],
          severities: ["critical"],
          missingCfIds: [10],
        }}
        onChange={vi.fn()}
      />,
    );
    // Three sheet-managed axes set → badge shows "3".
    expect(screen.getByText("3")).toBeInTheDocument();
  });
});

describe("MobileFilterBar — sheet trigger", () => {
  it("opens the FilterSheet when the Filters button is tapped", async () => {
    renderWithProviders(<MobileFilterBar {...baseProps} onChange={vi.fn()} />);
    expect(screen.getByTestId("filter-sheet")).toHaveAttribute(
      "data-open",
      "false",
    );
    await userEvent.click(screen.getByRole("button", { name: /filters/i }));
    expect(screen.getByTestId("filter-sheet")).toHaveAttribute(
      "data-open",
      "true",
    );
  });

  it("reflects sheet-open state via aria-expanded on the trigger", async () => {
    renderWithProviders(<MobileFilterBar {...baseProps} onChange={vi.fn()} />);
    const trigger = screen.getByRole("button", { name: /filters/i });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });
});

describe("MobileFilterBar — auto-hide", () => {
  function getBar() {
    return screen.getByRole("toolbar");
  }

  it("stays visible when scroll direction is null (initial)", () => {
    mockDirection = null;
    renderWithProviders(<MobileFilterBar {...baseProps} onChange={vi.fn()} />);
    expect(getBar().className).not.toContain("translate-y");
  });

  it("stays visible when scrolling up", () => {
    mockDirection = "up";
    renderWithProviders(<MobileFilterBar {...baseProps} onChange={vi.fn()} />);
    expect(getBar().className).not.toContain("translate-y");
  });

  it("hides via translate-y when scrolling down", () => {
    mockDirection = "down";
    renderWithProviders(<MobileFilterBar {...baseProps} onChange={vi.fn()} />);
    expect(getBar().className).toMatch(/translate-y/);
  });

  it("stays visible when scrolling down WHILE the sheet is open", async () => {
    mockDirection = "down";
    renderWithProviders(<MobileFilterBar {...baseProps} onChange={vi.fn()} />);
    // First the bar should be hidden (sheet is closed).
    expect(getBar().className).toMatch(/translate-y/);
    // Open the sheet — the auto-hide must release so the trigger
    // doesn't slip out from under the user's finger.
    await userEvent.click(screen.getByRole("button", { name: /filters/i }));
    expect(getBar().className).not.toMatch(/translate-y/);
  });

  it("applies a transition class when motion is allowed", () => {
    mockReducedMotion = false;
    renderWithProviders(<MobileFilterBar {...baseProps} onChange={vi.fn()} />);
    expect(getBar().className).toContain("transition-transform");
  });

  it("omits the transition class when prefers-reduced-motion is on", () => {
    mockReducedMotion = true;
    renderWithProviders(<MobileFilterBar {...baseProps} onChange={vi.fn()} />);
    expect(getBar().className).not.toContain("transition-transform");
  });
});
