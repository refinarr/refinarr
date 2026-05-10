"use client";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { Checkbox } from "@/client/components/ui/checkbox";
import type { Density } from "@/client/hooks/ui/useDensity";
import { cn } from "@/client/lib/utils";
import { MediaCard } from "./MediaCard";

// Pixel-perfect row heights matching --spacing-row-* tokens in globals.css.
// The virtualizer needs a number, not a CSS var, for estimateSize.
const ROW_HEIGHT_PX = { compact: 36, cozy: 48 } as const;

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
  // Active row density. "compact" = h-row-compact (~36px), "cozy" =
  // h-row-cozy (~48px, default). Read from useDensity() in the shell.
  density?: Density;
}

// Track scroll position on the nearest scroll container so the sticky
// header gets a backdrop-blur once the user scrolls past the top.
function useScrolledPast(threshold: number) {
  const [scrolled, setScrolled] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    // Walk up until we find a scrollable ancestor; window scroll is
    // the fallback so most pages get the effect even when the table
    // itself isn't the scroll container.
    let scroller: HTMLElement | Window = window;
    let parent: HTMLElement | null = node.parentElement;
    while (parent) {
      const overflow = window.getComputedStyle(parent).overflowY;
      if (overflow === "auto" || overflow === "scroll") {
        scroller = parent;
        break;
      }
      parent = parent.parentElement;
    }
    const onScroll = () => {
      const top =
        scroller === window
          ? window.scrollY
          : (scroller as HTMLElement).scrollTop;
      setScrolled(top > threshold);
    };
    scroller.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => scroller.removeEventListener("scroll", onScroll);
  }, [threshold]);
  return { ref, scrolled };
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
  density = "cozy",
}: Props<T>) {
  const { ref: tableRef, scrolled } = useScrolledPast(4);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const [scrollMargin, setScrollMargin] = useState(0);
  const rowHeight = ROW_HEIGHT_PX[density];

  // Recompute scrollMargin whenever the body's offset within the page
  // changes (e.g. window resize, sticky header height shift). useLayout-
  // Effect avoids the one-frame flicker that would happen if we read
  // offsetTop after paint.
  useLayoutEffect(() => {
    const node = bodyRef.current;
    if (!node) return;
    const measure = () => setScrollMargin(node.offsetTop);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  // Window-scoped virtualization: the page (not the table) is the scroll
  // container, so we hand the virtualizer the body's offset within the
  // viewport via scrollMargin. Result: only the visible rows + overscan
  // are mounted, regardless of total count. Pairs naturally with
  // useInfiniteScroll's sentinel (still visible to IntersectionObserver
  // because the spacer keeps real document height).
  const virtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: () => rowHeight,
    overscan: 8,
    scrollMargin,
  });

  if (rows.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  const tableHidden = renderCard ? "hidden lg:block" : "";
  const rowHeightClass = density === "compact" ? "h-row-compact" : "h-row-cozy";
  // Grid template: checkbox column + one track per data column. Each
  // column contributes `auto` width unless it has a `w-*` className,
  // in which case CSS-grid gathers it from the cell. Title gets `1fr`
  // so it absorbs spare space.
  const gridTemplate = `2.5rem ${columns
    .map((c) => {
      if (c.key === "title") return "minmax(0,1fr)";
      // Pull explicit widths out of className (w-N or w-Nrem) by
      // reading the className text — keeps the contract simple
      // without changing every column def.
      const widthMatch = c.className?.match(/(?:^|\s)w-(\d+)(?:\s|$)/);
      if (widthMatch) {
        const n = Number(widthMatch[1]);
        return `${n * 0.25}rem`;
      }
      return "auto";
    })
    .join(" ")}`;

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
      <div
        ref={tableRef}
        className={cn("overflow-x-auto rounded-lg border", tableHidden)}
      >
        <div role="table" className="w-full text-sm">
          <div
            role="rowgroup"
            className={cn(
              "sticky top-0 z-10 border-b transition-colors",
              scrolled
                ? "bg-background/80 supports-backdrop-filter:backdrop-blur-sm"
                : "bg-background",
            )}
          >
            <div
              role="row"
              className="text-muted-foreground grid items-center text-left text-xs tracking-wide uppercase"
              style={{ gridTemplateColumns: gridTemplate }}
            >
              <div role="columnheader" aria-hidden className="px-3 py-2.5" />
              {columns.map((col) => {
                const isActiveSort = col.sortKey === sortBy;
                let ariaSort: "ascending" | "descending" | "none" | undefined;
                if (col.sortKey && !isActiveSort) ariaSort = "none";
                else if (isActiveSort)
                  ariaSort = order === "asc" ? "ascending" : "descending";
                const SortIcon = order === "asc" ? ChevronUp : ChevronDown;
                return (
                  <div
                    key={col.key}
                    role="columnheader"
                    className={cn("px-3 py-2.5 font-medium", col.className)}
                    aria-sort={ariaSort}
                  >
                    <span className="inline-flex min-w-0 items-center gap-1">
                      {col.sortKey ? (
                        <button
                          type="button"
                          className="hover:text-foreground inline-flex cursor-pointer items-center gap-1 select-none"
                          onClick={() => onSortChange(col.sortKey!)}
                        >
                          <span className="truncate">{col.header}</span>
                          <SortIcon
                            className={cn(
                              "text-foreground size-3.5 shrink-0 transition-opacity",
                              isActiveSort ? "opacity-100" : "opacity-0",
                            )}
                            aria-hidden
                          />
                        </button>
                      ) : (
                        col.header
                      )}
                      {col.filter}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          <div
            ref={bodyRef}
            role="rowgroup"
            data-testid="media-table-body"
            style={{ height: virtualizer.getTotalSize(), position: "relative" }}
          >
            {virtualizer.getVirtualItems().map((vRow) => {
              const row = rows[vRow.index];
              if (!row) return null;
              return (
                <div
                  key={row.id}
                  role="row"
                  data-index={vRow.index}
                  className={cn(
                    "group hover:bg-muted/50 grid cursor-pointer items-center border-t transition-colors",
                    rowHeightClass,
                    selectedIds.has(row.id) && "bg-brand/10",
                  )}
                  style={{
                    gridTemplateColumns: gridTemplate,
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    transform: `translateY(${vRow.start - scrollMargin}px)`,
                  }}
                  onClick={() => onRowClick(row.id)}
                >
                  <div
                    role="cell"
                    className="flex items-center px-3"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleSelect(row.id);
                    }}
                  >
                    <Checkbox
                      checked={selectedIds.has(row.id)}
                      onCheckedChange={() => onToggleSelect(row.id)}
                    />
                  </div>
                  {columns.map((col) => (
                    <div
                      key={col.key}
                      role="cell"
                      className={cn(
                        "min-w-0 px-3",
                        col.className,
                        col.key === "title" && "truncate",
                      )}
                    >
                      {col.render(row)}
                    </div>
                  ))}
                  {rowActions && (
                    <div
                      role="cell"
                      className="bg-muted/60 absolute top-0 right-0 flex h-full items-center gap-1 px-3 opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {rowActions(row)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
