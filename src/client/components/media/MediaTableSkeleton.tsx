"use client";
import { Skeleton } from "@/client/components/ui/skeleton";
import { useDensity } from "@/client/hooks/ui/useDensity";
import { cn } from "@/client/lib/utils";

interface Props {
  rows?: number;
}

// Matches the live MediaListShell view at BOTH breakpoints so the swap
// from skeleton → content doesn't reflow: the desktop table grid (lg+,
// h-row-{compact,cozy} from globals.css) and the mobile card list (below
// lg, h-card-min cards). Rendering only the table grid on mobile showed a
// fixed ~488px 8-column grid that overflowed the viewport and then swapped
// to cards.
export function MediaTableSkeleton({ rows = 10 }: Props) {
  const { density } = useDensity();
  const rowHeight = density === "compact" ? "h-row-compact" : "h-row-cozy";
  return (
    <>
      {/* Desktop: table grid */}
      <div className="hidden overflow-hidden rounded-lg border lg:block">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "grid items-center gap-3 border-t px-3 first:border-t-0",
              rowHeight,
            )}
            style={{
              gridTemplateColumns:
                "2.5rem 2rem minmax(0,1fr) 2rem 9rem 9rem 6rem minmax(0,1fr)",
            }}
          >
            <Skeleton className="size-4 shrink-0 rounded-sm" />
            <Skeleton className="size-3 rounded-full" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="size-3.5 rounded-sm" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-32" />
          </div>
        ))}
      </div>
      {/* Mobile: card list (mirrors MediaCardList / MediaCardSkeleton) */}
      <div className="lg:hidden">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="pb-card-gap">
            <Skeleton className="h-card-min w-full rounded-lg" />
          </div>
        ))}
      </div>
    </>
  );
}
