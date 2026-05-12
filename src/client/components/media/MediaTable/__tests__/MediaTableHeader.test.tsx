// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { renderWithProviders as render, screen } from "@/test/render";
import { MediaTable, type ColumnDef } from "../MediaTable";

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

const rows: Row[] = [{ id: 1, title: "Alpha" }];

const baseColumns: ColumnDef<Row>[] = [
  {
    id: "title",
    accessorFn: (r) => r.title,
    header: () => "Title",
    size: 200,
    meta: { sortKey: "title" },
    cell: ({ row: { original: r } }) => r.title,
  },
  {
    id: "score",
    accessorFn: (r) => r.id,
    header: () => "Score",
    size: 100,
    meta: { sortKey: "score" },
    cell: ({ row: { original: r } }) => r.id,
  },
  // Unsortable column.
  {
    id: "actions",
    header: () => "Actions",
    size: 80,
    enableSorting: false,
    cell: () => "—",
  },
];

const baseProps = {
  rows,
  columns: baseColumns,
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

describe("MediaTableHeader (via MediaTable)", () => {
  beforeEach(() => {
    mockMatchMedia(true);
  });

  it("renders one column header per column plus the leading select-all checkbox cell", () => {
    render(<MediaTable {...baseProps} />);
    const headers = screen.getAllByRole("columnheader");
    expect(headers).toHaveLength(4);
    expect(headers[1]).toHaveTextContent("Title");
    expect(headers[2]).toHaveTextContent("Score");
    expect(headers[3]).toHaveTextContent("Actions");
  });

  it("fires onSortChange with the column's sortKey when a sortable header is clicked", async () => {
    const onSortChange = vi.fn();
    render(<MediaTable {...baseProps} onSortChange={onSortChange} />);
    await userEvent.click(screen.getByRole("button", { name: /score/i }));
    expect(onSortChange).toHaveBeenCalledWith("score");
  });

  it("does NOT render a sort button on columns without enableSorting", () => {
    render(<MediaTable {...baseProps} />);
    expect(
      screen.queryByRole("button", { name: /actions/i }),
    ).not.toBeInTheDocument();
  });

  it("marks the active sort column with aria-sort='ascending' when order='asc'", () => {
    render(<MediaTable {...baseProps} sortBy="title" order="asc" />);
    const titleHeader = screen.getByRole("columnheader", { name: /title/i });
    expect(titleHeader).toHaveAttribute("aria-sort", "ascending");
  });

  it("flips aria-sort to 'descending' when order='desc' on the active column", () => {
    render(<MediaTable {...baseProps} sortBy="title" order="desc" />);
    const titleHeader = screen.getByRole("columnheader", { name: /title/i });
    expect(titleHeader).toHaveAttribute("aria-sort", "descending");
  });

  it("marks inactive sortable columns with aria-sort='none'", () => {
    render(<MediaTable {...baseProps} sortBy="title" order="asc" />);
    const scoreHeader = screen.getByRole("columnheader", { name: /score/i });
    expect(scoreHeader).toHaveAttribute("aria-sort", "none");
  });

  it("omits aria-sort on unsortable columns", () => {
    render(<MediaTable {...baseProps} />);
    const actionsHeader = screen.getByRole("columnheader", {
      name: /actions/i,
    });
    expect(actionsHeader).not.toHaveAttribute("aria-sort");
  });

  it("renders meta.filter inline alongside the header label", () => {
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
    const header = funnel.closest('[role="columnheader"]');
    expect(header).not.toBeNull();
    expect(header!.textContent).toMatch(/title/i);
  });

  it("renders a resize handle on resizable columns", () => {
    render(<MediaTable {...baseProps} />);
    const handles = screen
      .getAllByRole("separator")
      .filter((el) => el.getAttribute("aria-orientation") === "vertical");
    // 3 data columns × 1 resize handle each
    expect(handles).toHaveLength(3);
    expect(handles[0]).toHaveAttribute(
      "aria-label",
      expect.stringMatching(/resize/i),
    );
  });
});
