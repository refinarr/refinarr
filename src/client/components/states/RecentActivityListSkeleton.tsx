"use client";
import { Card, CardContent, CardHeader } from "@/client/components/ui/card";
import { Skeleton } from "@/client/components/ui/skeleton";

// Mirrors RecentActivityList (header + a divide-y list of rows) so the
// activity card reserves height during summary load instead of rendering its
// short empty-state and then growing into the list.
export function RecentActivityListSkeleton() {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between pb-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-16" />
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {Array.from({ length: 5 }).map((_, i) => (
            <li key={i} className="flex items-center gap-3 py-2">
              <Skeleton className="h-5 w-20 shrink-0" />
              <Skeleton className="h-5 w-24 shrink-0" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-3 w-12 shrink-0" />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
