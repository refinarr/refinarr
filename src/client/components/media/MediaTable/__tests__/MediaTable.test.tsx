// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { MediaTable, type ColumnDef } from "../MediaTable";

interface Row {
  id: number;
  title: string;
}

const rows: Row[] = [
  { id: 1, title: "Alpha" },
  { id: 2, title: "Bravo" },
];

const columns: ColumnDef<Row>[] = [
  { key: "title", header: "Title", sortKey: "title", render: (r) => r.title },
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
};

describe("MediaTable", () => {
  it("renders only the table when renderCard is not provided", () => {
    render(<MediaTable {...baseProps} />);
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("renders both card list (lg:hidden) and table (hidden lg:block) when renderCard is provided", () => {
    render(
      <MediaTable
        {...baseProps}
        renderCard={(r) => <span data-testid={`card-${r.id}`}>{r.title}</span>}
      />,
    );
    const list = screen.getByRole("list");
    expect(list.className).toContain("lg:hidden");
    expect(screen.getByTestId("card-1")).toHaveTextContent("Alpha");
    expect(screen.getByTestId("card-2")).toHaveTextContent("Bravo");
    const tableWrapper = screen.getByRole("table").parentElement!;
    expect(tableWrapper.className).toContain("hidden lg:block");
  });

  it("fires onRowClick when a card body is clicked", async () => {
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

  it("stops click propagation from the checkbox so onRowClick is not triggered", async () => {
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
});
