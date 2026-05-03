import { Checkbox } from "@/client/components/ui/checkbox";
import type { ReactNode } from "react";
import { MediaCard } from "./MediaCard";

export type SortDirection = "asc" | "desc";

export interface ColumnDef<T> {
  key: string;
  header: ReactNode;
  sortKey?: "score" | "title" | "added" | "size";
  className?: string;
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

  const tableHidden = renderCard ? "hidden md:block" : "";

  return (
    <>
      {renderCard && (
        <ul className="flex flex-col gap-2 md:hidden">
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
      <div className={`rounded-lg border overflow-hidden ${tableHidden}`}>
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-background border-b z-10">
            <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="w-10 px-3 py-2.5" />
              {columns.map((col) => {
                const isActiveSort = col.sortKey === sortBy;
                const arrow = !isActiveSort ? "" : order === "asc" ? " ↑" : " ↓";
                return (
                  <th
                    key={col.key}
                    className={`px-3 py-2.5 font-medium ${col.className ?? ""} ${col.sortKey ? "cursor-pointer select-none hover:text-foreground" : ""}`}
                    onClick={col.sortKey ? () => onSortChange(col.sortKey!) : undefined}
                  >
                    {col.header}
                    {arrow && <span className="text-foreground">{arrow}</span>}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className="group relative border-t hover:bg-muted/40 cursor-pointer transition-colors"
                onClick={() => onRowClick(row.id)}
              >
                <td
                  className="px-3 py-2 align-middle"
                  onClick={(e) => { e.stopPropagation(); onToggleSelect(row.id); }}
                >
                  <Checkbox checked={selectedIds.has(row.id)} onCheckedChange={() => onToggleSelect(row.id)} />
                </td>
                {columns.map((col) => (
                  <td key={col.key} className={`px-3 py-2 align-middle ${col.className ?? ""}`}>
                    {col.render(row)}
                  </td>
                ))}
                {rowActions && (
                  <td
                    className="absolute right-0 top-0 h-full px-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-muted/60"
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
