"use client";
import { Card, CardContent, CardHeader } from "@/client/components/ui/card";
import { Skeleton } from "@/client/components/ui/skeleton";

export function KpiCardSkeleton() {
  return (
    <Card>
      {/* Heights mirror the loaded KpiCard so there's no layout shift on
          load: the title is text-xs (16px line-height = h-4), the value is
          text-3xl (36px line-height = h-9). */}
      <CardHeader className="pb-2">
        <Skeleton className="h-4 w-24" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-9 w-16" />
      </CardContent>
    </Card>
  );
}
