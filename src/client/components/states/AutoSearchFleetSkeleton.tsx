"use client";
import { Skeleton } from "@/client/components/ui/skeleton";

interface Props {
  // Number of placeholder rows — pass the count of auto-search-enabled
  // instances (known from useInstances) so the reserved height matches the
  // real panel that renders once the summary loads.
  rows: number;
}

// Mirrors AutoSearchFleetPanel (heading + bordered divide-y row group). Only
// rendered when at least one instance has auto-search enabled, matching the
// real panel's `return null` when the fleet is empty.
export function AutoSearchFleetSkeleton({ rows }: Props) {
  return (
    <div>
      <Skeleton className="mb-2 h-6 w-40" />
      <div className="bg-card divide-border divide-y rounded-lg border px-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-2">
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-16 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
