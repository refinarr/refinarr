"use client";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
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
  const [scrollElement, setScrollElement] = useState<HTMLElement | null>(null);
  const [scrollMargin, setScrollMargin] = useState(0);
  const rowHeight = ROW_HEIGHT_PX[density];

  // Find the nearest scrollable ancestor and recompute scrollMargin (the
  // body's offset within that scroller) whenever the body shifts —
  // density changes, sticky header height changes, window resize.
  // useLayoutEffect avoids the one-frame flicker if we read offsetTop
  // after paint. Falls back to AppShell's <main> when the walk doesn't
  // find a scrollable parent (e.g. wrapping div with no overflow).
  useLayoutEffect(() => {
    const node = bodyRef.current;
    if (!node) return;

    let scroller: HTMLElement | null = null;
    let parent = node.parentElement;
    while (parent) {
      const overflow = window.getComputedStyle(parent).overflowY;
      if (overflow === "auto" || overflow === "scroll") {
        scroller = parent;
        break;
      }
      parent = parent.parentElement;
    }
    if (!scroller) scroller = document.getElementById("main");
    setScrollElement(scroller);

    const measure = () => {
      if (!scroller) return;
      const bodyTop = node.getBoundingClientRect().top;
      const scrollerTop = scroller.getBoundingClientRect().top;
      setScrollMargin(bodyTop - scrollerTop + scroller.scrollTop);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  // Element-scoped virtualization. AppShell's <main> is the actual scroll
  // container (its overflow-y-auto traps the document scroll), so window
  // virtualization never picks up the events — that's why earlier only
  // the initial slice rendered. Hand the virtualizer the real scroll
  // element + the body's offset within it via scrollMargin. Result: only
  // the visible rows + overscan are mounted, regardless of total count.
  // Pairs naturally with useInfiniteScroll's sentinel (still visible to
  // IntersectionObserver because the spacer keeps real document height).
  // overscan = how many rows above/below the viewport stay mounted to
  // mask fast-scroll latency. 8 was too tight: on a flick scroll the
  // user could outrun the buffer faster than the virtualizer's RAF
  // could re-measure, leaving a blank gap for ~1 frame. 24 keeps
  // ~2 viewports of rows mounted at cozy density (~12 rows on screen)
  // — enough headroom for most flick gestures, still ~30 DOM nodes
  // total versus thousands without virt.
  const virtualizer = useVirtualizer({
    count: rows.length,
    estimateSize: () => rowHeight,
    overscan: 24,
    scrollMargin,
    getScrollElement: () => scrollElement,
  });

  if (rows.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  const tableHidden = renderCard ? "hidden lg:block" : "";
  const rowHeightClass = density === "compact" ? "h-row-compact" : "h-row-cozy";
  // Grid template: checkbox column + one track per data column.
  //
  // - Title is bounded (`minmax(8rem, 24rem)`) so short titles hug content
  //   instead of leaving a huge gap after the text, and very long titles
  //   stop at 24rem and rely on the `truncate` cell class.
  // - The LAST column without a `w-N` class (typically `issues` /
  //   `penalties`) gets `1fr` to absorb leftover viewport width — that's
  //   the column whose content (CF badge list) actually wants to flex.
  // - Columns with `w-N` classes use `minmax(0, Nrem)` so the track is
  //   strict (CSS Grid otherwise auto-grows tracks to fit content; the
  //   bare `Nrem` form was treating widths as min-only and Profile was
  //   stretching past `w-36` to fit "Ultra-HD WEB Preferred").
  const lastFlexIndex = columns.findLastIndex(
    (c) => c.key !== "title" && !c.className?.match(/(?:^|\s)w-(\d+)(?:\s|$)/),
  );
  const gridTemplate = `2.5rem ${columns
    .map((c, i) => {
      if (c.key === "title") return "minmax(8rem,24rem)";
      if (i === lastFlexIndex) return "minmax(0,1fr)";
      const widthMatch = c.className?.match(/(?:^|\s)w-(\d+)(?:\s|$)/);
      if (widthMatch) {
        const n = Number(widthMatch[1]);
        return `minmax(0,${n * 0.25}rem)`;
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
      {/*
        No `overflow-x-auto` on the wrapper: that would create a scroll
        container and scope the sticky header inside it (sticky bounds to
        the nearest non-visible-overflow ancestor). With CSS Grid +
        min-w-0 cells, the table doesn't horizontally overflow at lg+
        widths anyway; mobile uses the card list above and never reaches
        this code path.
      */}
      <div ref={tableRef} className={cn("rounded-lg border", tableHidden)}>
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
            style={
              scrollElement
                ? {
                    height: virtualizer.getTotalSize(),
                    position: "relative",
                  }
                : undefined
            }
          >
            {(scrollElement
              ? virtualizer.getVirtualItems().map((vRow) => ({
                  row: rows[vRow.index],
                  index: vRow.index,
                  offset: vRow.start - scrollMargin,
                  virt: true as const,
                }))
              : rows.map((row, index) => ({
                  row,
                  index,
                  offset: 0,
                  virt: false as const,
                }))
            ).map(({ row, index, offset, virt }) => {
              if (!row) return null;
              return (
                <div
                  key={row.id}
                  role="row"
                  data-index={index}
                  className={cn(
                    "group hover:bg-muted/50 grid cursor-pointer items-center border-t transition-colors",
                    rowHeightClass,
                    selectedIds.has(row.id) && "bg-brand/10",
                  )}
                  style={
                    virt
                      ? {
                          gridTemplateColumns: gridTemplate,
                          position: "absolute",
                          top: 0,
                          left: 0,
                          right: 0,
                          transform: `translateY(${offset}px)`,
                        }
                      : { gridTemplateColumns: gridTemplate }
                  }
                  onClick={() => onRowClick(row.id)}
                >
                  <div
                    role="cell"
                    className="flex items-center px-3"
                    onClick={(e) => e.stopPropagation()}
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
