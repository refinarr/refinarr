// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { renderWithProviders as render, screen } from "@/test/render";
import { MediaTable, type ColumnDef } from "../MediaTable";

// Helper to control the media query MediaTable uses to pick desktop vs
// mobile rendering. Default to desktop unless a test opts into mobile.
function mockMatchMedia(isDesktop: boolean): void {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query === "(min-width: 1024px)" ? isDesktop : false,
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

const rows: Row[] = [
  { id: 1, title: "Alpha" },
  { id: 2, title: "Bravo" },
];

const columns: ColumnDef<Row>[] = [
  {
    id: "title",
    accessorFn: (r) => r.title,
    header: () => "Title",
    size: 200,
    meta: { sortKey: "title" },
    cell: ({ row: { original: r } }) => r.title,
  },
];

const baseProps = {
  rows,
  columns,
  selectedIds: new Set<number>(),
  onToggleSelect: vi.fn(),
  onRowClick: vi.fn(),
  sortBy: "title" as const,
  order: "asc" as const,
  onSortChange: vi.fn(),
  allSelected: false,
  someSelected: false,
  onToggleAll: vi.fn(),
  tableId: "test",
};

describe("MediaTable", () => {
  beforeEach(() => {
    mockMatchMedia(true);
  });

  it("renders only the table when renderCard is not provided", () => {
    render(<MediaTable {...baseProps} />);
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("desktop viewport renders only the table (not the mobile cards)", () => {
    mockMatchMedia(true);
    render(
      <MediaTable
        {...baseProps}
        renderCard={(r) => <span data-testid={`card-${r.id}`}>{r.title}</span>}
      />,
    );
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(screen.queryByTestId("card-1")).not.toBeInTheDocument();
  });

  it("mobile viewport renders only the card list (not the table)", () => {
    mockMatchMedia(false);
    render(
      <MediaTable
        {...baseProps}
        renderCard={(r) => <span data-testid={`card-${r.id}`}>{r.title}</span>}
      />,
    );
    expect(screen.getByRole("list")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByTestId("card-1")).toHaveTextContent("Alpha");
    expect(screen.getByTestId("card-2")).toHaveTextContent("Bravo");
  });

  it("fires onRowClick when a card body is clicked (mobile)", async () => {
    mockMatchMedia(false);
    const onRowClick = vi.fn();
    render(
      <MediaTable
        {...baseProps}
        onRowClick={onRowClick}
        renderCard={(r) => <span data-testid={`card-${r.id}`}>{r.title}</span>}
      />,
    );
    await userEvent.click(screen.getByTestId("card-2"));
    expect(onRowClick).toHaveBeenCalledWith(2);
  });

  it("stops click propagation from the checkbox so onRowClick is not triggered (mobile)", async () => {
    mockMatchMedia(false);
    const onRowClick = vi.fn();
    render(
      <MediaTable
        {...baseProps}
        onRowClick={onRowClick}
        renderCard={(r) => <span data-testid={`card-${r.id}`}>{r.title}</span>}
      />,
    );
    const cards = screen.getAllByRole("listitem");
    const checkbox = cards[0].querySelector('button[role="checkbox"]')!;
    await userEvent.click(checkbox);
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it("density=poster renders the poster grid over the table/cards (desktop)", () => {
    mockMatchMedia(true);
    render(
      <MediaTable
        {...baseProps}
        density="poster"
        renderCard={(r) => <span data-testid={`card-${r.id}`}>{r.title}</span>}
        renderPoster={(r) => (
          <span data-testid={`poster-${r.id}`}>{r.title}</span>
        )}
      />,
    );
    expect(screen.getByTestId("media-poster-grid")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByTestId("card-1")).not.toBeInTheDocument();
    expect(screen.getByTestId("poster-1")).toHaveTextContent("Alpha");
  });

  it("density=poster shows the grid on mobile too (2-col)", () => {
    mockMatchMedia(false);
    render(
      <MediaTable
        {...baseProps}
        density="poster"
        renderCard={(r) => <span data-testid={`card-${r.id}`}>{r.title}</span>}
        renderPoster={(r) => (
          <span data-testid={`poster-${r.id}`}>{r.title}</span>
        )}
      />,
    );
    expect(screen.getByTestId("media-poster-grid")).toBeInTheDocument();
    expect(screen.queryByTestId("card-1")).not.toBeInTheDocument();
  });

  it("renders meta.filter inline next to the header label", () => {
    const columnsWithFilter: ColumnDef<Row>[] = [
      {
        id: "title",
        accessorFn: (r) => r.title,
        header: () => "Title",
        size: 200,
        meta: {
          sortKey: "title",
          filter: <button data-testid="title-funnel">funnel</button>,
        },
        cell: ({ row: { original: r } }) => r.title,
      },
    ];
    render(<MediaTable {...baseProps} columns={columnsWithFilter} />);
    const funnel = screen.getByTestId("title-funnel");
    expect(funnel).toBeInTheDocument();
    const header = funnel.closest('[role="columnheader"]')!;
    expect(header.textContent).toMatch(/title/i);
  });

  it("applies density-driven row height (cozy default)", () => {
    render(<MediaTable {...baseProps} />);
    const dataRows = screen
      .getByTestId("media-table-body")
      .querySelectorAll('[role="row"]');
    expect(dataRows[0].className).toContain("h-row-cozy");
  });

  it("applies compact row height when density='compact'", () => {
    render(<MediaTable {...baseProps} density="compact" />);
    const dataRows = screen
      .getByTestId("media-table-body")
      .querySelectorAll('[role="row"]');
    expect(dataRows[0].className).toContain("h-row-compact");
  });
});
