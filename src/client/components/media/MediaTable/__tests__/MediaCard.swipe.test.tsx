// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent } from "@testing-library/react";
import { renderWithProviders as render, screen } from "@/test/render";
import { MediaCard } from "../MediaCard";

// Drive the breakpoint hooks: ≤480px = phone (swipe), reduced-motion off.
function mockViewport({ phone }: { phone: boolean }): void {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query === "(max-width: 480px)" ? phone : false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

interface Row {
  id: number;
  title: string;
}
const row: Row = { id: 1, title: "Alpha" };

function renderCard(over: Partial<Parameters<typeof MediaCard<Row>>[0]> = {}) {
  const props = {
    row,
    selected: false,
    onToggleSelect: vi.fn(),
    onRowClick: vi.fn(),
    renderCard: (r: Row) => <span>{r.title}</span>,
    swipeActions: { onSearch: vi.fn(), onIgnore: vi.fn() },
    selectionActive: false,
    ...over,
  };
  render(<MediaCard {...props} />);
  return props;
}

function swipeLeft(dx: number, dy = 0): void {
  const surface = screen.getByTestId("media-card-surface");
  fireEvent.pointerDown(surface, { clientX: 200, clientY: 100, pointerId: 1 });
  fireEvent.pointerMove(surface, {
    clientX: 200 + dx,
    clientY: 100 + dy,
    pointerId: 1,
  });
  fireEvent.pointerUp(surface, {
    clientX: 200 + dx,
    clientY: 100 + dy,
    pointerId: 1,
  });
}

describe("MediaCard swipe-to-reveal (phone)", () => {
  beforeEach(() => mockViewport({ phone: true }));

  it("reveals Search/Ignore after a left swipe past the snap threshold", () => {
    const { swipeActions } = renderCard();
    swipeLeft(-60); // > 35% of 128px (~45px) → snaps open
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(swipeActions.onSearch).toHaveBeenCalledTimes(1);
  });

  it("a short swipe under the threshold snaps closed", () => {
    renderCard();
    swipeLeft(-20); // < threshold → snaps closed
    // Closed → the panel is aria-hidden, so its actions leave the a11y
    // tree (RTL role queries respect aria-hidden).
    expect(
      screen.queryByRole("button", { name: "Search" }),
    ).not.toBeInTheDocument();
  });

  it("axis-locks: a mostly-vertical drag does not reveal actions", () => {
    const { onRowClick } = renderCard();
    swipeLeft(-8, 40); // |dy| > |dx| → treated as scroll, no reveal
    fireEvent.click(screen.getByTestId("media-card-surface"));
    // Not opened, so the click falls through to the row tap.
    expect(onRowClick).toHaveBeenCalledTimes(1);
  });

  it("a horizontal drag swallows the click so the drawer doesn't open", () => {
    const { onRowClick } = renderCard();
    swipeLeft(-60);
    fireEvent.click(screen.getByTestId("media-card-surface"));
    // The post-drag synthetic click is suppressed; only a second click
    // (on the now-open card) would close it — never opens the drawer.
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it("disables swipe while selection is active", () => {
    renderCard({ selectionActive: true });
    expect(
      screen.queryByRole("button", { name: "Search" }),
    ).not.toBeInTheDocument();
  });
});

describe("MediaCard swipe-to-reveal (desktop)", () => {
  beforeEach(() => mockViewport({ phone: false }));

  it("renders inline hover actions, not the swipe panel", () => {
    renderCard({
      actions: <button type="button">hover-action</button>,
    });
    expect(screen.getByText("hover-action")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Search" }),
    ).not.toBeInTheDocument();
  });
});
