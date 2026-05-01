"use client";
import { Skeleton } from "@/client/components/ui/skeleton";

export function MediaTableSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg border px-4 py-3">
          <Skeleton className="h-4 w-4 shrink-0" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-10" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-32" />
        </div>
      ))}
    </div>
  );
}
