"use client";
import { Skeleton } from "@/client/components/ui/skeleton";
import { useDensity } from "@/client/hooks/ui/useDensity";
import { cn } from "@/client/lib/utils";

interface Props {
  rows?: number;
}

// Matches the live MediaTable's grid/density so the swap from skeleton →
// rows doesn't reflow. Uses h-row-{compact,cozy} from globals.css so any
// retune of those tokens carries through.
export function MediaTableSkeleton({ rows = 10 }: Props) {
  const { density } = useDensity();
  const rowHeight = density === "compact" ? "h-row-compact" : "h-row-cozy";
  return (
    <div className="overflow-hidden rounded-lg border">
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
  );
}
