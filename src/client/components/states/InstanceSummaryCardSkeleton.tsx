"use client";
import { Card, CardContent, CardHeader } from "@/client/components/ui/card";
import { Skeleton } from "@/client/components/ui/skeleton";

// Mirrors InstanceSummaryCard's structure (same CardHeader/CardContent
// wrappers, the bordered flagged-count box, and the footer row) so the
// dashboard reserves the instance grid's height while the summary loads —
// the cards going 0→N is the dominant dashboard layout shift.
export function InstanceSummaryCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Skeleton className="size-2 rounded-full" />
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-4 w-28" />
        </div>
        <Skeleton className="mt-1 h-3 w-20" />
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between rounded-md border px-3 py-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="size-4" />
        </div>
        <div className="flex items-center">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="ml-auto h-3 w-16" />
        </div>
      </CardContent>
    </Card>
  );
}
