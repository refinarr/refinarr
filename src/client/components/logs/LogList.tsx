"use client";
import { useCallback, useEffect, useRef } from "react";
import type { KeyboardEvent, RefObject } from "react";
import { useVirtList } from "@/client/hooks/ui/useVirtList";
import type { AppLogEntry } from "@/shared/types/models";
import { LogRow } from "./LogRow";

interface Props {
  entries: AppLogEntry[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  // Optional external ref to the scroll container — page-level hooks
  // (auto-scroll) read scrollTop from this. Internal ref is also kept
  // so useVirtList can measure heights.
  scrollContainerRef?: RefObject<HTMLDivElement | null>;
}

const ROW_HEIGHT_PX = 40;

function pickLogOverscan(count: number): number {
  if (count < 50) return 6;
  if (count < 200) return 12;
  return 20;
}

export function LogList({
  entries,
  selectedId,
  onSelect,
  scrollContainerRef,
}: Props) {
  // Two refs on purpose:
  //   • `scrollRef` (outer div) — the actual `overflow-auto` scroller.
  //     Owns focus + key handler + page-level autoscroll observation.
  //   • `bodyRef` (inner div) — what useVirtList measures from.
  //     useScrollContainer walks UP from this ref to find the nearest
  //     overflow-auto ancestor (= `scrollRef`). Passing the scroller
  //     itself would make the walk-up start from its parent and skip
  //     the actual scroller, binding the virtualizer to <main>.
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const setScrollRef = useCallback(
    (el: HTMLDivElement | null) => {
      scrollRef.current = el;
      if (scrollContainerRef) scrollContainerRef.current = el;
    },
    [scrollContainerRef],
  );

  const { items, virtEnabled, containerStyle } = useVirtList<AppLogEntry>({
    rows: entries,
    containerRef: bodyRef,
    estimateSize: ROW_HEIGHT_PX,
    pickOverscan: pickLogOverscan,
  });

  useEffect(() => {
    scrollRef.current?.focus();
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (entries.length === 0) return;
    if (event.key === "Escape") {
      event.preventDefault();
      onSelect(null);
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const currentIdx =
      selectedId === null ? -1 : entries.findIndex((e) => e.id === selectedId);
    let nextIdx = event.key === "ArrowDown" ? currentIdx + 1 : currentIdx - 1;
    if (currentIdx === -1 && event.key === "ArrowUp") nextIdx = 0;
    if (nextIdx < 0) nextIdx = 0;
    if (nextIdx > entries.length - 1) nextIdx = entries.length - 1;
    onSelect(entries[nextIdx].id);
  };

  return (
    <div
      ref={setScrollRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="focus-visible:ring-ring/40 relative h-full min-h-0 overflow-auto rounded-md border focus-visible:ring-2 focus-visible:outline-none"
    >
      <div ref={bodyRef} style={containerStyle}>
        {items.map(({ row, index, key, style, measureRef }) => {
          if (!row) {
            return (
              <div
                key={key}
                data-index={index}
                style={{ ...(style ?? {}), height: ROW_HEIGHT_PX }}
                className="bg-muted/20 animate-pulse border-b"
              />
            );
          }
          if (style) {
            return (
              <div
                key={key}
                ref={measureRef}
                data-index={index}
                style={{ ...style, width: "100%" }}
              >
                <LogRow
                  entry={row}
                  selected={row.id === selectedId}
                  onSelect={onSelect}
                />
              </div>
            );
          }
          return (
            <LogRow
              key={key}
              entry={row}
              selected={row.id === selectedId}
              onSelect={onSelect}
            />
          );
        })}
        {!virtEnabled && entries.length === 0 && null}
      </div>
    </div>
  );
}
