"use client";
import { Skeleton } from "@/client/components/ui/skeleton";

// Mirrors the history filter bar (three label+select groups + a clear
// button). Used in the page's Suspense fallback so the filter bar's height is
// reserved while HistoryContent suspends on useSearchParams() — without it the
// real filter bar pops in above the table skeleton on hydration and shoves it
// down (the largest history CLS contributor). Select/Button widths match the
// real controls (w-40 / w-36 / w-40).
export function HistoryFiltersSkeleton() {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex flex-col gap-1">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-control-sm w-40" />
      </div>
      <div className="flex flex-col gap-1">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-control-sm w-36" />
      </div>
      <div className="flex flex-col gap-1">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-control-sm w-40" />
      </div>
      <div className="ml-auto self-end">
        <Skeleton className="h-control-sm w-20" />
      </div>
    </div>
  );
}
