"use client";
import { useRef, type ReactNode } from "react";
import { useVirtList } from "@/client/hooks/ui/useVirtList";
import { MediaCard, type SwipeActions } from "./MediaCard";
import { MediaCardSkeleton } from "./MediaCardSkeleton";

// Cards measure ~90px (no CF row) to ~118px (with the CF-chip row that
// flagged items — the majority here — carry): p-3 shell 26 + content
// 56–84 + pb-card-gap 8. virt suppresses the ref-attach remeasure while
// `isScrolling` (virtual-core measureElement guard), so during a fast
// flick freshly-mounted cards briefly sit at THIS estimate before the
// ResizeObserver corrects them. Deliberately OVER-estimate at the
// height ceiling: an overestimate flashes a harmless gap, an
// underestimate stacks cards on top of each other (the bug this fixes).
export const CARD_HEIGHT_ESTIMATE_PX = 120;

function pickCardOverscan(count: number): number {
  if (count > 5000) return 3;
  if (count > 1000) return 6;
  return 12;
}

interface Props<T extends { id: number }> {
  rows: T[];
  selectedIds: Set<number>;
  onToggleSelect: (id: number) => void;
  onRowClick: (id: number) => void;
  renderCard: (row: T) => ReactNode;
  rowActions?: (row: T) => ReactNode;
  // Per-row handlers for the mobile swipe-to-reveal panel. When omitted,
  // cards fall back to the inline hover actions on every viewport.
  swipeActions?: (row: T) => SwipeActions;
  fetchNextPage?: () => unknown;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  focusedId?: number | null;
}

// Card list rendered on mobile, and also on desktop when the user picks
// the "card" view mode in DensityToggle. The OUTER wrapper is the
// scroll container (overflow-auto + flex-1) so the sticky AppShell
// chrome above stays pinned and only this list scrolls — matching the
// desktop table layout. Below the virt threshold we render flat with
// gap-card-gap; above the threshold the list pivots to absolute-
// positioned items so DOM count stays bounded.
export function MediaCardList<T extends { id: number }>({
  rows,
  selectedIds,
  onToggleSelect,
  onRowClick,
  renderCard,
  rowActions,
  swipeActions,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
  focusedId,
}: Props<T>) {
  const listRef = useRef<HTMLUListElement | null>(null);
  // Any selection active → suppress swipe so it doesn't fight the
  // checkbox tap / bulk bar.
  const selectionActive = selectedIds.size > 0;

  const { items, virtEnabled, containerStyle } = useVirtList<T>({
    rows,
    containerRef: listRef,
    estimateSize: CARD_HEIGHT_ESTIMATE_PX,
    pickOverscan: pickCardOverscan,
    measureElement: (el) => el.getBoundingClientRect().height,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  });

  return (
    // Scroll container: must own overflow-auto + a definite height
    // (flex-1 min-h-0 inside the parent flex-col). px gives cards
    // horizontal breathing room from the viewport edges on mobile and
    // ensures rounded card borders aren't cut off. data-scroll-root
    // tells useScrollDirection this is the page's vertical scroller so
    // mobile chrome auto-hide fires off the right element.
    <div
      data-scroll-root
      className="relative flex min-h-0 flex-1 flex-col overflow-auto p-3"
    >
      {/*
        max-w-5xl + mx-auto: keeps the card column centered on wide
        viewports (desktop "card" mode) so cards don't stretch the
        entire width. w-full keeps it filling at mobile widths.
      */}
      <ul
        ref={listRef}
        data-testid="media-card-list"
        className={
          virtEnabled
            ? "mx-auto w-full max-w-5xl"
            : "gap-card-gap mx-auto flex w-full max-w-5xl flex-col"
        }
        style={containerStyle}
      >
        {items.map(({ row, index, key, style, measureRef }) => {
          if (!row) {
            return (
              <MediaCardSkeleton
                key={key}
                index={index}
                style={{ ...(style ?? {}), width: style ? "100%" : undefined }}
              />
            );
          }
          const isFocused = focusedId === row.id;
          if (style) {
            // Cards are variable-height; let virt measure the real
            // height (height:undefined) and stretch to the list
            // column width (width:100%). Without these, every row
            // measures as `estimateSize` (100px) so cumulative
            // translateY offsets drift and cards overlap on fast
            // scroll, and cards collapse to title's intrinsic width.
            // `role="presentation"` makes assistive tech walk past this
            // wrapper so the <ul> ↔ <li> (inside MediaCard) list
            // semantics survive; the inner MediaCard is still the only
            // listitem the AT sees, matching the flat-render path.
            return (
              <div
                key={key}
                ref={measureRef}
                role="presentation"
                data-index={index}
                data-mediaid={row.id}
                className="pb-card-gap"
                style={{ ...style, height: undefined, width: "100%" }}
              >
                <MediaCard
                  row={row}
                  selected={selectedIds.has(row.id)}
                  onToggleSelect={() => onToggleSelect(row.id)}
                  onRowClick={() => onRowClick(row.id)}
                  renderCard={renderCard}
                  actions={rowActions?.(row)}
                  swipeActions={swipeActions?.(row)}
                  selectionActive={selectionActive}
                  focused={isFocused}
                />
              </div>
            );
          }
          return (
            <div key={key} data-mediaid={row.id}>
              <MediaCard
                row={row}
                selected={selectedIds.has(row.id)}
                onToggleSelect={() => onToggleSelect(row.id)}
                onRowClick={() => onRowClick(row.id)}
                renderCard={renderCard}
                actions={rowActions?.(row)}
                swipeActions={swipeActions?.(row)}
                selectionActive={selectionActive}
                focused={isFocused}
              />
            </div>
          );
        })}
      </ul>
    </div>
  );
}
