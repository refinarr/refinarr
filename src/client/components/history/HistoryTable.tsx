"use client";
import { useTranslations } from "next-intl";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/client/components/ui/table";
import { ActionStatusBadge } from "./ActionStatusBadge";
import { ActionTypeBadge } from "./ActionTypeBadge";
import { RetryButton } from "./RetryButton";
import { formatRelative } from "@/client/lib/format";
import type { ActionLog, ActionStatus } from "@/shared/types/models";

interface Props {
  logs: ActionLog[];
}

export function HistoryTable({ logs }: Props) {
  const tCols = useTranslations("history.columns");
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{tCols("date")}</TableHead>
          <TableHead>{tCols("action")}</TableHead>
          <TableHead>{tCols("title")}</TableHead>
          <TableHead>{tCols("status")}</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {logs.map((log) => (
          <TableRow key={log.id}>
            <TableCell
              className="text-xs text-muted-foreground whitespace-nowrap"
              title={new Date(log.createdAt).toLocaleString()}
            >
              {formatRelative(log.createdAt)}
            </TableCell>
            <TableCell>
              <ActionTypeBadge action={log.action} />
            </TableCell>
            <TableCell className="text-sm">{log.title}</TableCell>
            <TableCell>
              <ActionStatusBadge status={log.status as ActionStatus} />
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
