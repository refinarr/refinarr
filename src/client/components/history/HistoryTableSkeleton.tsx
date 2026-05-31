"use client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/client/components/ui/table";
import { Skeleton } from "@/client/components/ui/skeleton";

interface Props {
  rows?: number;
  // Header is shown for the initial load (matches HistoryTable's header
  // row) but omitted when this skeleton is appended below an existing
  // table for infinite-scroll "loading more".
  header?: boolean;
}

// Mirrors HistoryTable's 5-column shadcn layout (date / action / title /
// status / retry) so the swap from skeleton → rows doesn't reflow. Uses
// the same Table primitives, so row height tracks the real table.
export function HistoryTableSkeleton({ rows = 10, header = true }: Props) {
  return (
    <Table>
      {header && (
        <TableHeader>
          <TableRow>
            {Array.from({ length: 4 }).map((_, i) => (
              <TableHead key={i}>
                <Skeleton className="h-4 w-16" />
              </TableHead>
            ))}
            <TableHead />
          </TableRow>
        </TableHeader>
      )}
      <TableBody>
        {Array.from({ length: rows }).map((_, i) => (
          <TableRow key={i}>
            <TableCell>
              <Skeleton className="h-4 w-28" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-5 w-16 rounded-full" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-48" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-5 w-20 rounded-full" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-8 w-16" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
