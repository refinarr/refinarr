"use client";
import { type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Checkbox } from "@/client/components/ui/checkbox";
import { useInfiniteScroll } from "@/client/hooks/ui/useInfiniteScroll";
import { cn } from "@/client/lib/utils";

interface Props<T extends { id: number }> {
  rows: T[];
  selectedIds: Set<number>;
  onToggleSelect: (id: number) => void;
  onRowClick: (id: number) => void;
  renderPoster: (row: T) => ReactNode;
  fetchNextPage?: () => unknown;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  focusedId?: number | null;
}

// Responsive poster grid — the "visual browse" density (desktop opt-in
// via DensityToggle, 2-col on mobile). Posters stream lazily through the
// auth-gated proxy (see PosterTile), so only on-screen tiles hit the
// network.
//
// v1 is intentionally NOT virtualized: pagination (fetchNextPage, ~50/
// page) bounds how many tiles mount, and lazy <img> bounds the heavy
// memory. DOM node count still grows as the user deep-scrolls a very
// large "show all" library — grid virtualization (chunked rows through
// useVirtList) is the tracked follow-up if that becomes a problem.
export function MediaPosterGrid<T extends { id: number }>({
  rows,
  selectedIds,
  onToggleSelect,
  onRowClick,
  renderPoster,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
  focusedId,
}: Props<T>) {
  const tCommon = useTranslations("common");
  const tBulk = useTranslations("bulk");
  const sentinelRef = useInfiniteScroll(
    () => fetchNextPage?.(),
    !!hasNextPage && !!fetchNextPage,
  );

  return (
    // Scroll container mirrors MediaCardList: owns overflow-auto + a
    // definite height so the sticky AppShell chrome stays pinned and
    // only the grid scrolls. data-scroll-root wires ScrollToTopButton
    // and mobile chrome auto-hide to this element.
    <div
      data-scroll-root
      className="relative flex min-h-0 flex-1 flex-col overflow-auto p-3"
    >
      <ul
        data-testid="media-poster-grid"
        className="mx-auto grid w-full max-w-screen-2xl grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
      >
        {rows.map((row) => (
          <li
            key={row.id}
            data-mediaid={row.id}
            onClick={() => onRowClick(row.id)}
            className={cn(
              "group relative cursor-pointer rounded-md",
              focusedId === row.id && "ring-brand ring-2 ring-offset-2",
            )}
          >
            {/* The pill IS the control (role=checkbox): the whole 44px tap
                area toggles on a coarse pointer (#94/#101), and it's the
                single click handler. The inner Checkbox is purely visual
                (aria-hidden + pointer-events-none) — leaving it interactive
                made it emit two bubbling clicks (button + hidden form input)
                that double-toggled to a no-op. */}
            <span
              data-testid="media-select-target"
              role="checkbox"
              aria-checked={selectedIds.has(row.id)}
              aria-label={tBulk("selectRow")}
              tabIndex={0}
              className={cn(
                "bg-background/85 focus-visible:ring-brand absolute top-1 left-1 z-10 rounded-sm p-0.5 backdrop-blur-sm transition-opacity outline-none focus-visible:ring-2",
                "pointer-coarse:flex pointer-coarse:size-11 pointer-coarse:items-center pointer-coarse:justify-center pointer-coarse:p-0",
                selectedIds.has(row.id)
                  ? "opacity-100"
                  : "opacity-0 group-hover:opacity-100 focus-within:opacity-100 pointer-coarse:opacity-100",
              )}
              onClick={(e) => {
                e.stopPropagation();
                onToggleSelect(row.id);
              }}
              onKeyDown={(e) => {
                if (e.key === " " || e.key === "Enter") {
                  e.preventDefault();
                  e.stopPropagation();
                  onToggleSelect(row.id);
                }
              }}
            >
              <Checkbox
                checked={selectedIds.has(row.id)}
                aria-hidden
                tabIndex={-1}
                className="pointer-events-none"
              />
            </span>
            {renderPoster(row)}
          </li>
        ))}
      </ul>
      {hasNextPage && <div ref={sentinelRef} aria-hidden className="h-px" />}
      {isFetchingNextPage && (
        <div
          aria-live="polite"
          className="text-muted-foreground flex items-center justify-center gap-2 py-4 text-xs"
        >
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          <span>{tCommon("loadingMore")}</span>
        </div>
      )}
    </div>
  );
}
