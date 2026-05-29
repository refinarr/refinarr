"use client";
import { memo, type CSSProperties, type ReactNode } from "react";
import {
  flexRender,
  type ColumnSizingState,
  type Row,
} from "@tanstack/react-table";
import { Checkbox } from "@/client/components/ui/checkbox";
import { cn } from "@/client/lib/utils";

interface Props<T extends { id: number }> {
  row: Row<T>;
  rowData: T;
  index: number;
  selected: boolean;
  // True when this row is the deep-link target (history / dashboard
  // titles). Drives `data-focused` which a CSS rule animates with a
  // brief glow so the user sees where they landed.
  focused: boolean;
  onToggleSelect: (id: number) => void;
  onRowClick: (id: number) => void;
  rowActions?: (row: T) => ReactNode;
  rowHeightClass: string;
  // Pre-merged virt positioning (absolute + translateY) when virt-mode.
  // undefined in flat mode.
  style: CSSProperties | undefined;
  selectColumnPx: number;
  actionsColumnPx: number;
  // Whole TanStack columnSizing object. Included in the memo so that
  // resizing a column re-renders visible rows with the new cell widths;
  // without it the bag of props the memo compares stays equal and the
  // row keeps its stale widths. Also bumps when the columns array
  // identity changes (e.g. ctx-driven rebuild of column defs after
  // profiles load), which forces row re-render with fresh cell content.
  columnSizing: ColumnSizingState;
  // Localized aria-label for the row's select checkbox. Passed from the
  // table root so the i18n namespace stays centralised.
  selectAriaLabel: string;
}

function MediaTableRowImpl<T extends { id: number }>({
  row,
  rowData,
  index,
  selected,
  focused,
  onToggleSelect,
  onRowClick,
  rowActions,
  rowHeightClass,
  style,
  selectColumnPx,
  actionsColumnPx,
  selectAriaLabel,
}: Props<T>) {
  return (
    <div
      role="row"
      data-index={index}
      data-mediaid={rowData.id}
      data-focused={focused || undefined}
      // bg-background: rows are opaque, so the wrapper bg never bleeds
      //   through a row's content area. Without this, transparent rows
      //   layered over the wrapper bg can momentarily look "blank"
      //   during a virt re-render mid-scroll.
      // contain: layout paint: each row is a paint-isolated unit, so
      //   the browser doesn't re-layout/repaint the entire list when
      //   one row's content changes (hover, selection, search badge).
      className={cn(
        "bg-background hover:bg-muted/50 flex min-w-full cursor-pointer items-center border-t contain-[layout_paint]",
        rowHeightClass,
        selected && "bg-brand/10",
        focused && "media-row-focused",
      )}
      style={style}
      onClick={() => onRowClick(rowData.id)}
    >
      <div
        role="cell"
        className="flex shrink-0 items-center px-3"
        style={{ width: selectColumnPx }}
        onClick={(e) => e.stopPropagation()}
      >
        <Checkbox
          checked={selected}
          onCheckedChange={() => onToggleSelect(rowData.id)}
          aria-label={selectAriaLabel}
        />
      </div>
      {row.getVisibleCells().map((cell) => {
        const meta = cell.column.columnDef.meta;
        return (
          <div
            key={cell.id}
            role="cell"
            className={cn(
              "min-w-0 shrink-0 px-3",
              meta?.grow && "grow",
              meta?.className,
              cell.column.id === "title" && "truncate",
            )}
            style={{ width: cell.column.getSize() }}
          >
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </div>
        );
      })}
      {rowActions && (
        <div
          role="cell"
          className="flex shrink-0 items-center justify-end gap-0.5 pr-2 pl-1"
          style={{ width: actionsColumnPx }}
          onClick={(e) => e.stopPropagation()}
        >
          {rowActions(rowData)}
        </div>
      )}
    </div>
  );
}

// Memo: the big perf win for flick-scroll. Without it, every scroll
// event re-renders 30+ virt-visible rows × ~7 heavy cells each, even
// though the data for rows that stayed in the window didn't change.
// React's commit lag during a fast flick is what makes the content
// briefly disappear ("black flash").
//
// We bypass the default shallow compare because `style` is a new
// object every render (virt rebuilds it from getVirtualItems()) and
// `row` (TanStack's row instance) may also be new identity per
// render. The fields that ACTUALLY matter for visual output:
//   - rowData identity (data changed → re-render)
//   - selected (selection toggle → re-render the bg + checkbox)
//   - index (rare, but virt may reuse slots — keep correctness)
//   - rowHeightClass (density toggle)
//   - style.transform (virt repositions row → DOM transform needs to
//     update; we compare the transform string, not the object)
//   - style.height (virt re-measures after a density toggle; for
//     row 0 the transform stays at translateY(0) and rowHeightClass
//     was already updated one render earlier, so without comparing
//     height the row keeps its stale inline pixel height and
//     overlaps the next row).
// Other props (callbacks, dimension primitives, rowActions) are
// stable across normal scroll. If any of them change, the row will
// still re-render via Object.is on the closure ID's component scope.
function rowPropsEqual<T extends { id: number }>(
  prev: Props<T>,
  next: Props<T>,
): boolean {
  return (
    prev.rowData === next.rowData &&
    prev.selected === next.selected &&
    prev.focused === next.focused &&
    prev.index === next.index &&
    prev.rowHeightClass === next.rowHeightClass &&
    prev.style?.transform === next.style?.transform &&
    prev.style?.height === next.style?.height &&
    prev.selectColumnPx === next.selectColumnPx &&
    prev.actionsColumnPx === next.actionsColumnPx &&
    prev.columnSizing === next.columnSizing &&
    prev.selectAriaLabel === next.selectAriaLabel
  );
  // Intentionally NOT compared:
  //  - row (TanStack row instance): new identity each render but content
  //    is derived from rowData + stable column defs.
  //  - rowActions / onToggleSelect / onRowClick: callsite typically
  //    creates new closures each parent render. Their behavior is
  //    deterministic from the rowData + stable context, so skipping a
  //    re-render is safe; we'd otherwise defeat memoization entirely.
}

export const MediaTableRow = memo(
  MediaTableRowImpl,
  rowPropsEqual,
) as typeof MediaTableRowImpl;
