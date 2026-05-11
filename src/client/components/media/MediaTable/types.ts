import type { ReactNode } from "react";
import type { ColumnDef as TanstackColumnDef } from "@tanstack/react-table";

export type SortDirection = "asc" | "desc";

export type SortKey = "score" | "title" | "added" | "size";

// Public column-def alias. Callers (movieColumns / seriesColumns) declare
// TanStack column defs directly and pass them to <MediaTable>.
export type ColumnDef<T> = TanstackColumnDef<T>;

// Custom per-column metadata wired in via TanStack's `meta` slot. Carries
// the inline filter funnel, an optional className applied to the cell,
// and the server-side sort key (TanStack's column.id is what we sort by
// in the UI; sortKey is what we send to /api/...).
declare module "@tanstack/react-table" {
  // The generics MUST match TanStack's declaration to merge.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    filter?: ReactNode;
    className?: string;
    sortKey?: SortKey;
    // When true, the cell + header use `flex-grow: 1` so the column
    // absorbs any leftover horizontal space inside the row. Only ONE
    // column should be marked grow per table; otherwise the slack is
    // split between them. Used for the "issues/penalties" column so
    // rows visually fill the table wrapper instead of leaving a dead
    // zone on wide viewports.
    grow?: boolean;
  }
}
