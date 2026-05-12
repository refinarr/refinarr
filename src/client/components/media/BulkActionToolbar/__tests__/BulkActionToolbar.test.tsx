// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, screen } from "@/test/render";

// Stub the scroll-direction hook so anchor-swap behavior is testable
// without needing to drive a real scroll event in jsdom/happy-dom.
let mockDirection: "up" | "down" | null = null;
vi.mock("@/client/hooks/ui/useScrollDirection", () => ({
  useScrollDirection: () => mockDirection,
}));

import { BulkActionToolbar } from "../BulkActionToolbar";

describe("BulkActionToolbar", () => {
  beforeEach(() => {
    mockDirection = null;
  });
  it("renders the toolbar with disabled buttons when nothing is selected", () => {
    renderWithProviders(
      <BulkActionToolbar
        selectedCount={0}
        onSearch={vi.fn()}
        onDelete={vi.fn()}
        onIgnore={vi.fn()}
      />,
    );
    // Previously this returned null on empty selection. The new
    // contract: the toolbar is always rendered so its row doesn't
    // appear/disappear in the layout; the four action buttons are
    // disabled until a row is selected.
    expect(screen.getByRole("button", { name: /^search$/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^ignore$/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^delete$/i })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /delete and search/i }),
    ).toBeDisabled();
  });

  it("renders all four actions when count > 0", () => {
    renderWithProviders(
      <BulkActionToolbar
        selectedCount={3}
        onSearch={vi.fn()}
        onDelete={vi.fn()}
        onIgnore={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: /^search$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^ignore$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^delete$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /delete and search/i }),
    ).toBeInTheDocument();
  });

  it("anchors above the filter bar on mobile (top of the 3-stack) by default", () => {
    renderWithProviders(
      <BulkActionToolbar
        selectedCount={1}
        onSearch={vi.fn()}
        onDelete={vi.fn()}
        onIgnore={vi.fn()}
      />,
    );
    const toolbar = screen.getByText(/1 selected/i).parentElement!;
    expect(toolbar.className).toContain("fixed");
    // Default mobile anchor — above the tab bar + filter bar +
    // safe-area. The three bars stack from viewport bottom upwards:
    // tab → filter → bulk.
    expect(toolbar.className).toContain(
      "bottom-[calc(var(--spacing-bottom-bar)+var(--spacing-mobile-filter-bar)+env(safe-area-inset-bottom))]",
    );
    expect(toolbar.className).toContain("z-30");
    // Desktop drops sticky in favour of inline flow (qui pattern) — two
    // sticky elements (this bar + MediaTableHeader) caused layout
    // jumping when this one mounted/unmounted. md:static reverts to
    // normal flow so the bar slots into the page chrome.
    expect(toolbar.className).toContain("md:static");
    expect(toolbar.className).not.toContain("md:sticky");
  });

  it("drops to the viewport bottom anchor when the user scrolls down with a selection", () => {
    mockDirection = "down";
    renderWithProviders(
      <BulkActionToolbar
        selectedCount={1}
        onSearch={vi.fn()}
        onDelete={vi.fn()}
        onIgnore={vi.fn()}
      />,
    );
    const toolbar = screen.getByText(/1 selected/i).parentElement!;
    // Anchor swap: tab + filter just slid off-screen, bulk slides down
    // into the slot they vacated. Bottom is now just env(safe-area).
    expect(toolbar.className).toContain("bottom-[env(safe-area-inset-bottom)]");
    expect(toolbar.className).not.toContain(
      "bottom-[calc(var(--spacing-bottom-bar)+var(--spacing-mobile-filter-bar)+env(safe-area-inset-bottom))]",
    );
  });

  it("returns to the above-filter anchor when scroll direction flips back to up", () => {
    mockDirection = "up";
    renderWithProviders(
      <BulkActionToolbar
        selectedCount={1}
        onSearch={vi.fn()}
        onDelete={vi.fn()}
        onIgnore={vi.fn()}
      />,
    );
    const toolbar = screen.getByText(/1 selected/i).parentElement!;
    expect(toolbar.className).toContain(
      "bottom-[calc(var(--spacing-bottom-bar)+var(--spacing-mobile-filter-bar)+env(safe-area-inset-bottom))]",
    );
  });

  it("renders an aria-live progress UI in place of action buttons when progress is provided", () => {
    renderWithProviders(
      <BulkActionToolbar
        selectedCount={5}
        progress={{ current: 3, total: 5, action: "search" }}
        onSearch={vi.fn()}
        onDelete={vi.fn()}
        onIgnore={vi.fn()}
      />,
    );
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveTextContent(/searching 3\/5/i);
    expect(
      screen.queryByRole("button", { name: /^search$/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/5 selected/i)).not.toBeInTheDocument();
  });

  it("still renders the toolbar with progress when nothing is selected (final tick after clearing)", () => {
    renderWithProviders(
      <BulkActionToolbar
        selectedCount={0}
        progress={{ current: 5, total: 5, action: "delete" }}
        onSearch={vi.fn()}
        onDelete={vi.fn()}
        onIgnore={vi.fn()}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(/deleting 5\/5/i);
  });

  it("renders a Cancel button in progress mode and fires onCancel when clicked", async () => {
    const onCancel = vi.fn();
    renderWithProviders(
      <BulkActionToolbar
        selectedCount={5}
        progress={{ current: 2, total: 5, action: "search" }}
        onSearch={vi.fn()}
        onDelete={vi.fn()}
        onIgnore={vi.fn()}
        onCancel={onCancel}
      />,
    );
    const cancelBtn = screen.getByRole("button", { name: /^cancel$/i });
    expect(cancelBtn).toBeInTheDocument();
    await userEvent.click(cancelBtn);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("does not render a Cancel button in progress mode when onCancel is not provided", () => {
    renderWithProviders(
      <BulkActionToolbar
        selectedCount={5}
        progress={{ current: 2, total: 5, action: "search" }}
        onSearch={vi.fn()}
        onDelete={vi.fn()}
        onIgnore={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /^cancel$/i }),
    ).not.toBeInTheDocument();
  });
});
