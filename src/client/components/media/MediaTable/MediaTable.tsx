"use client";
import { useMemo, useRef, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import {
  getCoreRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import type { Density } from "@/client/hooks/ui/useDensity";
import { useIsDesktop } from "@/client/hooks/ui/useMediaQuery";
import { useColumnSizing } from "@/client/hooks/media/useColumnSizing";
import { useVirtList } from "@/client/hooks/ui/useVirtList";
import { MediaPosterGrid } from "@/client/components/media/MediaPosterGrid";
import { MediaCardList } from "./MediaCardList";
import type { SwipeActions } from "./MediaCard";
import { MediaTableHeader } from "./MediaTableHeader";
import { MediaTableRow } from "./MediaTableRow";
import { MediaTableSkeletonRow } from "./MediaTableSkeletonRow";
import type { ColumnDef, SortDirection, SortKey } from "./types";

export type { ColumnDef };

const ROW_HEIGHT_PX = { compact: 36, cozy: 48 } as const;

// Width of the leading select-all column and the trailing row-actions
// column. Both are fixed and rendered outside the TanStack column model
// — they are infrastructure, not data columns.
const SELECT_COLUMN_PX = 40;
const ACTIONS_COLUMN_PX = 62;

// Adaptive overscan tuned to dataset size — qui's pattern. Bigger
// lists get LOWER overscan because each row's render cost grows;
// mounting 100 buffer rows you can't see is worse than briefly missing
// one when the user outscrolls the buffer. Skeleton placeholders fill
// any visible gap so the trade-off is invisible.
function pickRowOverscan(count: number): number {
  // Tuned against fast flick-scroll: small/medium lists get a wide
  // buffer so React can keep up with rapid scroll events without
  // dropping a frame between commits (visible as a black flash). Very
  // large lists trade buffer width for per-row render cost.
  if (count > 50000) return 4;
  if (count > 10000) return 8;
  if (count > 1000) return 16;
  return 30;
}

interface Props<T extends { id: number }> {
  rows: T[];
  columns: ColumnDef<T>[];
  selectedIds: Set<number>;
  onToggleSelect: (id: number) => void;
  onRowClick: (id: number) => void;
  sortBy: SortKey;
  order: SortDirection;
  onSortChange: (key: SortKey) => void;
  rowActions?: (row: T) => ReactNode;
  renderCard?: (row: T) => ReactNode;
  // Poster-tile content for density="poster". Same role as renderCard
  // but for the grid view; supplied for movies/shows.
  renderPoster?: (row: T) => ReactNode;
  // Per-row handlers for the mobile card swipe-to-reveal actions.
  swipeActions?: (row: T) => SwipeActions;
  emptyState?: ReactNode;
  // Active row density (desktop only). "compact" = h-row-compact (~36px),
  // "cozy" = h-row-cozy (~48px, default). Read from useDensity().
  density?: Density;
  // Range-based pagination — when virt's last visible index approaches
  // the end of `rows`, the table calls fetchNextPage.
  fetchNextPage?: () => unknown;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  // Master "select all" state — drives the checkbox in the column
  // header. Desktop-only chrome; mobile cards have their own per-card
  // checkbox and don't render this.
  allSelected: boolean;
  someSelected: boolean;
  onToggleAll: () => void;
  // localStorage key used to persist column widths separately per
  // table (e.g. "movies", "shows"). Required so widths don't leak
  // between pages.
  tableId: string;
  // Id of a row to scroll into view + briefly highlight. Set by
  // MediaListShell when the page receives `?focus=<id>` (history /
  // dashboard deep-links). Null/undefined disables.
  focusedId?: number | null;
}

export function MediaTable<T extends { id: number }>(props: Props<T>) {
  const isDesktop = useIsDesktop();

  if (props.rows.length === 0 && props.emptyState) {
    return <>{props.emptyState}</>;
  }

  // Poster grid wins over both the card list and the table whenever the
  // user picked density="poster" — on desktop AND mobile (the grid is
  // 2-col on mobile). Requires renderPoster (passed for movies/shows).
  if (props.density === "poster" && props.renderPoster) {
    return (
      <MediaPosterGrid
        rows={props.rows}
        selectedIds={props.selectedIds}
        onToggleSelect={props.onToggleSelect}
        onRowClick={props.onRowClick}
        renderPoster={props.renderPoster}
        focusedId={props.focusedId}
        fetchNextPage={props.fetchNextPage}
        hasNextPage={props.hasNextPage}
        isFetchingNextPage={props.isFetchingNextPage}
      />
    );
  }

  // Card list is rendered when:
  //   - viewport is mobile (mobile path is always cards), OR
  //   - desktop and the user picked density="card" in the top bar.
  // Both require renderCard to be supplied (we pass it for movies/shows).
  const useCardList =
    props.renderCard && (!isDesktop || props.density === "card");
  if (useCardList) {
    return (
      <MediaCardList
        rows={props.rows}
        selectedIds={props.selectedIds}
        onToggleSelect={props.onToggleSelect}
        onRowClick={props.onRowClick}
        renderCard={props.renderCard!}
        rowActions={props.rowActions}
        swipeActions={props.swipeActions}
        focusedId={props.focusedId}
        fetchNextPage={props.fetchNextPage}
        hasNextPage={props.hasNextPage}
        isFetchingNextPage={props.isFetchingNextPage}
      />
    );
  }

  return <MediaTableDesktopBody {...props} />;
}

function MediaTableDesktopBody<T extends { id: number }>({
  rows,
  columns,
  selectedIds,
  onToggleSelect,
  onRowClick,
  sortBy,
  order,
  onSortChange,
  rowActions,
  density = "cozy",
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
  allSelected,
  someSelected,
  onToggleAll,
  tableId,
  focusedId,
}: Props<T>) {
  const tableRef = useRef<HTMLDivElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  // Only "compact" and "cozy" reach the desktop table; the parent
  // short-circuits "card"/"poster" to MediaCardList before getting here.
  const rowDensity: "compact" | "cozy" =
    density === "compact" ? "compact" : "cozy";
  const rowHeight = ROW_HEIGHT_PX[rowDensity];
  const rowHeightClass =
    rowDensity === "compact" ? "h-row-compact" : "h-row-cozy";
  const hasActions = !!rowActions;

  const { columnSizing, onColumnSizingChange, resetColumnSize } =
    useColumnSizing(tableId);
  const tBulk = useTranslations("bulk");
  const tCommon = useTranslations("common");
  const selectRowAriaLabel = tBulk("selectRow");

  // Bridge server-side sort into TanStack's controlled state. We map by
  // `meta.sortKey` (the column's id may differ from the server's sort
  // key, though by convention they match). manualSorting = true means
  // TanStack tracks state + drives the header's API but does NOT
  // actually sort rows — that happens server-side.
  const sorting = useMemo<SortingState>(() => {
    const match = columns.find((c) => c.meta?.sortKey === sortBy && c.id);
    if (!match?.id) return [];
    return [{ id: match.id, desc: order === "desc" }];
  }, [columns, sortBy, order]);

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => String(row.id),
    state: { sorting, columnSizing },
    manualSorting: true,
    manualFiltering: true,
    enableColumnResizing: true,
    columnResizeMode: "onChange",
    // Force a 2-state cycle (asc ↔ desc). TanStack's default 3-state
    // cycle includes "unsorted" — landing in that state would call our
    // onSortingChange with an empty array, the early-return below skips
    // the page-level onSortChange, and the column appears "stuck" after
    // two clicks. The page treats sortBy as a required field, so the
    // 3rd state has no representation upstream anyway.
    enableSortingRemoval: false,
    onColumnSizingChange,
    onSortingChange: (updater) => {
      const next = typeof updater === "function" ? updater(sorting) : updater;
      if (next.length === 0) return;
      const nextId = next[0].id;
      const sortKey = columns.find((c) => c.id === nextId)?.meta?.sortKey;
      if (sortKey) onSortChange(sortKey);
    },
    autoResetPageIndex: false,
  });

  const tableRows = table.getRowModel().rows;

  const { items, virtEnabled, containerStyle } = useVirtList<T>({
    rows,
    containerRef: bodyRef,
    estimateSize: rowHeight,
    pickOverscan: pickRowOverscan,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  });

  return (
    // The wrapper IS the scroll container for both axes (qui pattern).
    // - overflow-auto: horizontal scroll appears when a resized column
    //   pushes the row past the wrapper width; vertical scroll appears
    //   when the row count exceeds the wrapper height.
    // - flex-1 + min-h-0: takes all available height inside main's
    //   flex-col layout. Without min-h-0, intrinsic content min-content
    //   would push the wrapper taller than main, breaking the scroll.
    // - The sticky header inside pins to the wrapper's top edge.
    <div
      ref={tableRef}
      data-scroll-root
      className="bg-background relative min-h-0 flex-1 overflow-auto border-y will-change-transform contain-paint select-none"
    >
      <div role="table" className="w-max min-w-full text-sm">
        <MediaTableHeader
          table={table}
          containerRef={tableRef}
          hasActions={hasActions}
          allSelected={allSelected}
          someSelected={someSelected}
          onToggleAll={onToggleAll}
          selectColumnPx={SELECT_COLUMN_PX}
          actionsColumnPx={ACTIONS_COLUMN_PX}
          onResetColumnSize={resetColumnSize}
        />
        <div
          ref={bodyRef}
          role="rowgroup"
          data-testid="media-table-body"
          className="bg-background"
          style={containerStyle}
        >
          {items.map(({ row, index, style: virtStyle }) => {
            if (!row) {
              return (
                <MediaTableSkeletonRow
                  key={`skeleton-${index}`}
                  index={index}
                  columns={columns}
                  rowHeightClass={rowHeightClass}
                  style={virtStyle}
                  hasActions={hasActions}
                  selectColumnPx={SELECT_COLUMN_PX}
                  actionsColumnPx={ACTIONS_COLUMN_PX}
                  getColumnWidth={(id) => table.getColumn(id)?.getSize() ?? 0}
                />
              );
            }
            const tableRow = tableRows[index];
            if (!tableRow) {
              // virt and TanStack should always agree — effectiveCount
              // in useVirtList is `rows.length + skeleton-buffer`, and
              // we hit the skeleton branch above when `row` is
              // undefined. If we're here with no tableRow, virt is
              // projecting an index past the table row model, which is
              // a sync bug worth surfacing in dev.
              if (process.env.NODE_ENV !== "production") {
                console.warn(
                  `[MediaTable] virt projected index ${index} but tableRows has length ${tableRows.length}`,
                );
              }
              return null;
            }
            return (
              <MediaTableRow
                key={row.id}
                row={tableRow}
                rowData={row}
                index={index}
                selected={selectedIds.has(row.id)}
                focused={focusedId === row.id}
                onToggleSelect={onToggleSelect}
                onRowClick={onRowClick}
                rowActions={rowActions}
                rowHeightClass={rowHeightClass}
                style={virtStyle}
                selectColumnPx={SELECT_COLUMN_PX}
                actionsColumnPx={ACTIONS_COLUMN_PX}
                columnSizing={columnSizing}
                selectAriaLabel={selectRowAriaLabel}
              />
            );
          })}
          <span hidden data-virt-enabled={virtEnabled} />
        </div>
      </div>
      {isFetchingNextPage && (
        // Sticky-bottom indicator inside the scroll container — pins to
        // the bottom edge of the visible viewport so the user always
        // sees "loading more" without it stealing layout height from
        // the table below. Lives INSIDE the wrapper (no longer in
        // MediaListShell), so it can't push table rows out of view.
        <div
          aria-live="polite"
          className="bg-background/95 border-border/60 text-muted-foreground sticky inset-x-0 bottom-0 flex shrink-0 items-center justify-center gap-2 border-t px-3 py-2 text-xs"
        >
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          <span>{tCommon("loadingMore")}</span>
        </div>
      )}
    </div>
  );
}
