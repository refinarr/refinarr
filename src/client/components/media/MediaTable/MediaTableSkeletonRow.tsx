"use client";
import type { CSSProperties } from "react";
import { cn } from "@/client/lib/utils";
import type { ColumnDef } from "./types";

interface Props<T> {
  index: number;
  columns: ColumnDef<T>[];
  rowHeightClass: string;
  style: CSSProperties | undefined;
  hasActions?: boolean;
  selectColumnPx: number;
  actionsColumnPx: number;
  // Resolves a column's current width (TanStack size or default).
  // Looked up by column id so the skeleton row's cells align with the
  // resized data rows above.
  getColumnWidth: (columnId: string) => number;
}

// Skeleton placeholder rendered for indices past loaded data — keeps
// the body filled while the next page is in flight, so the user never
// sees blank space below the loaded rows.
export function MediaTableSkeletonRow<T>({
  index,
  columns,
  rowHeightClass,
  style,
  hasActions,
  selectColumnPx,
  actionsColumnPx,
  getColumnWidth,
}: Props<T>) {
  return (
    <div
      role="row"
      aria-hidden
      data-index={index}
      data-skeleton
      className={cn("flex items-center border-t", rowHeightClass)}
      style={style}
    >
      <div
        role="cell"
        className="flex shrink-0 items-center px-3"
        style={{ width: selectColumnPx }}
      >
        <div className="bg-muted/50 size-4 animate-pulse rounded-sm" />
      </div>
      {columns.map((col) => {
        const id = col.id ?? "";
        const width = getColumnWidth(id) || col.size || 80;
        const isIconColumn = width <= 48;
        return (
          <div
            key={id}
            role="cell"
            className={cn(
              "min-w-0 shrink-0 px-3",
              col.meta?.grow && "grow",
              col.meta?.className,
            )}
            style={{ width }}
          >
            <div
              className={cn(
                "bg-muted/50 animate-pulse rounded-sm",
                isIconColumn ? "size-3" : "h-3 w-1/2",
              )}
            />
          </div>
        );
      })}
      {hasActions && (
        <div
          role="cell"
          aria-hidden
          className="shrink-0"
          style={{ width: actionsColumnPx }}
        />
      )}
    </div>
  );
}
