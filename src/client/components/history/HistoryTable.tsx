"use client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/client/components/ui/table";
import { ActionStatusBadge } from "./ActionStatusBadge";
import { RetryButton } from "./RetryButton";
import type { ActionLog } from "@/shared/types/models";

interface Props {
  logs: ActionLog[];
}

export function HistoryTable({ logs }: Props) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Action</TableHead>
          <TableHead>Title</TableHead>
          <TableHead>Dry Run</TableHead>
          <TableHead>Status</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {logs.map((log) => (
          <TableRow key={log.id}>
            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
              {new Date(log.createdAt).toLocaleString()}
            </TableCell>
            <TableCell className="capitalize text-sm">{log.action.replace("_", " ")}</TableCell>
            <TableCell className="text-sm">{log.title}</TableCell>
            <TableCell>{log.isDryRun ? "Yes" : "No"}</TableCell>
            <TableCell>
              <ActionStatusBadge status={log.status as import("@/shared/types/models").ActionStatus} />
            </TableCell>
            <TableCell>
              {log.status === "failed" && log.payload && (
                <RetryButton logId={log.id} title={log.title} />
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
