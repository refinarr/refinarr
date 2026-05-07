import type { ReactNode } from "react";
import { Checkbox } from "@/client/components/ui/checkbox";
import { MediaCard } from "./MediaCard";

export type SortDirection = "asc" | "desc";

export interface ColumnDef<T> {
  key: string;
  header: ReactNode;
  sortKey?: "score" | "title" | "added" | "size";
  className?: string;
  // Optional filter trigger rendered inline next to the header (Excel
  // / Airtable-style funnel popover). Column defs decide which slice
  // of the page-level filter state this column controls.
  filter?: ReactNode;
  render: (row: T) => ReactNode;
}

interface Props<T extends { id: number }> {
  rows: T[];
  columns: ColumnDef<T>[];
  selectedIds: Set<number>;
  onToggleSelect: (id: number) => void;
  onRowClick: (id: number) => void;
  sortBy: "score" | "title" | "added" | "size";
  order: SortDirection;
  onSortChange: (key: "score" | "title" | "added" | "size") => void;
  rowActions?: (row: T) => ReactNode;
  renderCard?: (row: T) => ReactNode;
  emptyState?: ReactNode;
}

export function MediaTable<T extends { id: number }>({
  rows,
  columns,
  selectedIds,
  onToggleSelect,
  onRowClick,
  sortBy,
  order,
  onSortChange,
  rowActions,
  renderCard,
  emptyState,
}: Props<T>) {
  if (rows.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  const tableHidden = renderCard ? "hidden lg:block" : "";

  return (
    <>
      {renderCard && (
        <ul
          data-testid="media-card-list"
          className="flex flex-col gap-2 lg:hidden"
        >
          {rows.map((row) => (
            <MediaCard
              key={row.id}
              row={row}
              selected={selectedIds.has(row.id)}
              onToggleSelect={() => onToggleSelect(row.id)}
              onRowClick={() => onRowClick(row.id)}
              renderCard={renderCard}
              actions={rowActions?.(row)}
            />
          ))}
        </ul>
      )}
      <div className={`overflow-x-auto rounded-lg border ${tableHidden}`}>
        <table className="w-full text-sm">
          <thead className="bg-background sticky top-0 z-10 border-b">
            <tr className="text-muted-foreground text-left text-xs tracking-wide uppercase">
              <th className="w-10 px-3 py-2.5" />
              {columns.map((col) => {
                const isActiveSort = col.sortKey === sortBy;
                let ariaSort: "ascending" | "descending" | "none" | undefined;
                if (col.sortKey && !isActiveSort) ariaSort = "none";
                else if (isActiveSort)
                  ariaSort = order === "asc" ? "ascending" : "descending";
                let arrow = "";
                if (isActiveSort) arrow = order === "asc" ? " ↑" : " ↓";
                return (
                  <th
                    key={col.key}
                    className={`px-3 py-2.5 font-medium ${col.className ?? ""}`}
                    aria-sort={ariaSort}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.sortKey ? (
                        <button
                          type="button"
                          className="hover:text-foreground cursor-pointer select-none"
                          onClick={() => onSortChange(col.sortKey!)}
                        >
                          {col.header}
                          {arrow && (
                            <span className="text-foreground">{arrow}</span>
                          )}
                        </button>
                      ) : (
                        col.header
                      )}
                      {col.filter}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody data-testid="media-table-body">
            {rows.map((row) => (
              <tr
                key={row.id}
                className="group hover:bg-muted/40 relative cursor-pointer border-t transition-colors"
                onClick={() => onRowClick(row.id)}
              >
                <td
                  className="px-3 py-2 align-middle"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleSelect(row.id);
                  }}
                >
                  <Checkbox
                    checked={selectedIds.has(row.id)}
                    onCheckedChange={() => onToggleSelect(row.id)}
                  />
                </td>
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-3 py-2 align-middle ${col.className ?? ""}`}
                  >
                    {col.render(row)}
                  </td>
                ))}
                {rowActions && (
                  <td
                    className="bg-muted/60 absolute top-0 right-0 flex h-full items-center gap-1 px-3 opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {rowActions(row)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
