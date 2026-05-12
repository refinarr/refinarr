"use client";
import { useEffect, type CSSProperties, type RefObject } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useScrollContainer } from "./useScrollContainer";

const DEFAULT_VIRT_THRESHOLD = 200;
const DEFAULT_PREFETCH_AHEAD_ROWS = 30;

export interface UseVirtListOptions<T extends { id: number | string }> {
  rows: T[];
  containerRef: RefObject<HTMLElement | null>;
  estimateSize: number | ((index: number) => number);
  pickOverscan: (count: number) => number;
  measureElement?: (el: Element) => number;
  fetchNextPage?: () => unknown;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  // Below this count we render flat (no virt overhead). Default 200.
  virtThreshold?: number;
  // Trigger fetchNextPage when virt's last index >= rows.length - this.
  // Default 30.
  prefetchAheadRows?: number;
}

export interface VirtListItem<T> {
  // undefined when the index points past loaded data — caller renders a
  // skeleton placeholder using `index` and `style`.
  row: T | undefined;
  index: number;
  // row.id when loaded, `__skeleton-${index}` otherwise. Stable across
  // virt re-projections so React reconciliation stays cheap.
  key: string | number;
  // virt-mode positioning baked in (absolute + translateY). undefined
  // when rendering flat.
  style: CSSProperties | undefined;
  // Pass to a measured wrapper element so virt can read the row's actual
  // height. undefined in flat mode.
  measureRef: ((el: Element | null) => void) | undefined;
}

export interface UseVirtListResult<T> {
  items: VirtListItem<T>[];
  virtEnabled: boolean;
  totalSize: number;
  // {height, position:'relative'} when virt-enabled — apply to the
  // scroll body so absolute children position correctly. undefined in
  // flat mode.
  containerStyle: CSSProperties | undefined;
}

// Generalised virt + scroll + prefetch hook. Used by MediaTable
// (desktop grid) and MediaCardList (mobile cards); designed for reuse
// by future virt consumers like the logs page and history table.
//
// Policy with sensible defaults:
//   • below `virtThreshold` (200) we skip virt entirely and render flat
//   • adaptive overscan via caller-supplied `pickOverscan(count)`
//   • effective row count = max(rows.length, totalRows ?? 0) so virt
//     reserves slots for unloaded server-side rows; the caller renders
//     skeleton placeholders for `row === undefined`
//   • prefetch via virtualizer.onChange — fires when last visible index
//     approaches `rows.length - prefetchAheadRows`. Sync + isScrolling
//     guard prevents stacking requests mid-flick.
//   • virtualizer.measure() runs on count growth — fixes the stale-
//     geometry bug where new rows landed at wrong offsets until the
//     next user interaction.
export function useVirtList<T extends { id: number | string }>(
  opts: UseVirtListOptions<T>,
): UseVirtListResult<T> {
  const {
    rows,
    containerRef,
    estimateSize,
    pickOverscan,
    measureElement,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    virtThreshold = DEFAULT_VIRT_THRESHOLD,
    prefetchAheadRows = DEFAULT_PREFETCH_AHEAD_ROWS,
  } = opts;

  const { scrollElement, scrollMargin } = useScrollContainer(containerRef);

  // Effective virt count = loaded rows + a small ghost buffer of
  // skeleton slots when more pages exist. The scrollbar tracks
  // loaded + buffer (NOT the server's full totalRows), matching the
  // infinite-scroll UX of every modern list (Twitter, Slack, Linear).
  // Previously this used `Math.max(rows.length, totalRows ?? 0)` —
  // which on a 600-row list with 50 loaded would render 550 skeleton
  // rows during a fast flick. That was the "wall of skeletons" the
  // user called out as bad UX.
  const SKELETON_BUFFER = 8;
  const effectiveCount = rows.length + (hasNextPage ? SKELETON_BUFFER : 0);
  const overscan = pickOverscan(effectiveCount);

  const estimateSizeFn =
    typeof estimateSize === "function" ? estimateSize : () => estimateSize;

  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: effectiveCount,
    estimateSize: estimateSizeFn,
    overscan,
    scrollMargin,
    getScrollElement: () => scrollElement,
    measureElement,
    onChange: (instance, sync) => {
      if (!fetchNextPage || !hasNextPage || isFetchingNextPage) return;
      // Defer during rapid scroll — fires fetchNextPage only when the
      // scroll settles to avoid stacking requests mid-flick.
      if (sync && instance.isScrolling) return;
      const items = instance.getVirtualItems();
      if (items.length === 0) return;
      const last = items[items.length - 1].index;
      if (last >= rows.length - prefetchAheadRows) fetchNextPage();
    },
  });

  // Force virt to recompute when count grows OR estimateSize changes.
  // Without measure() on count growth, new rows land at stale offsets
  // until the next interaction. Without measure() on estimateSize, a
  // density toggle (cozy ↔ compact) leaves virt's cached positions
  // sized for the OLD row height — visually the rows render off-center
  // until the user reloads. estimateSize is added as a stable key
  // (numbers are stable between renders; function identity isn't, so
  // function callers must invalidate via their own ref-stability).
  const estimateSizeKey =
    typeof estimateSize === "function" ? null : estimateSize;
  useEffect(() => {
    virtualizer.measure();
  }, [effectiveCount, virtualizer, estimateSizeKey]);

  const virtEnabled = scrollElement !== null && effectiveCount >= virtThreshold;

  // Recompute every render — virtualizer's identity is stable but its
  // internal scroll/window state is what drives the projection. A
  // useMemo keyed on `virtualizer` would never invalidate during scroll,
  // freezing the visible window and producing blank flick-scroll. Cheap:
  // pure map over the visible window (~10–30 items).
  const items: VirtListItem<T>[] = virtEnabled
    ? virtualizer.getVirtualItems().map((vRow) => {
        const row = rows[vRow.index];
        // No `right: 0` — the row's width is driven by its flex
        // children (cells with explicit widths). Setting `right: 0`
        // would stretch the absolute row to the parent's width, which
        // is wrong when the parent is wider than the viewport (resized
        // columns) — cells would visually overflow past the right edge
        // but the row's box wouldn't, breaking horizontal scroll
        // tracking. No `will-change: transform` either: the scroll
        // CONTAINER has the will-change hint; promoting every row to
        // its own GPU layer wastes memory and on a slow Mac it can
        // actually drop frames during a fast flick.
        const style: CSSProperties = {
          position: "absolute",
          top: 0,
          left: 0,
          height: vRow.size,
          transform: `translateY(${vRow.start - scrollMargin}px)`,
        };
        return {
          row,
          index: vRow.index,
          key: row ? row.id : `__skeleton-${vRow.index}`,
          style,
          measureRef: row ? virtualizer.measureElement : undefined,
        };
      })
    : rows.map((row, index) => ({
        row,
        index,
        key: row.id,
        style: undefined,
        measureRef: undefined,
      }));

  const totalSize = virtEnabled ? virtualizer.getTotalSize() : 0;

  const containerStyle: CSSProperties | undefined = virtEnabled
    ? { height: totalSize, position: "relative" }
    : undefined;

  return { items, virtEnabled, totalSize, containerStyle };
}
