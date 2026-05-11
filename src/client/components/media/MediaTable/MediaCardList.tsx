"use client";
import { useRef, type ReactNode } from "react";
import { useVirtList } from "@/client/hooks/ui/useVirtList";
import { MediaCard } from "./MediaCard";
import { MediaCardSkeleton } from "./MediaCardSkeleton";

const CARD_HEIGHT_ESTIMATE_PX = 100;

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
  fetchNextPage?: () => unknown;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
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
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
}: Props<T>) {
  const listRef = useRef<HTMLUListElement | null>(null);

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
    // ensures rounded card borders aren't cut off.
    <div className="relative flex min-h-0 flex-1 flex-col overflow-auto p-3">
      {/*
        max-w-3xl + mx-auto: keeps the card column centered on wide
        viewports (desktop "card" mode) so cards don't stretch the
        entire width. w-full keeps it filling at mobile widths.
      */}
      <ul
        ref={listRef}
        data-testid="media-card-list"
        className={
          virtEnabled
            ? "mx-auto w-full max-w-3xl"
            : "gap-card-gap mx-auto flex w-full max-w-3xl flex-col"
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
          if (style) {
            // Cards are variable-height; let virt measure the real
            // height (height:undefined) and stretch to the list
            // column width (width:100%). Without these, every row
            // measures as `estimateSize` (100px) so cumulative
            // translateY offsets drift and cards overlap on fast
            // scroll, and cards collapse to title's intrinsic width.
            return (
              <div
                key={key}
                ref={measureRef}
                data-index={index}
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
                />
              </div>
            );
          }
          return (
            <MediaCard
              key={key}
              row={row}
              selected={selectedIds.has(row.id)}
              onToggleSelect={() => onToggleSelect(row.id)}
              onRowClick={() => onRowClick(row.id)}
              renderCard={renderCard}
              actions={rowActions?.(row)}
            />
          );
        })}
      </ul>
    </div>
  );
}
