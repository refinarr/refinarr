"use client";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/client/components/ui/card";
import { ActionStatusBadge } from "@/client/components/history/ActionStatusBadge";
import { ActionTypeBadge } from "@/client/components/history/ActionTypeBadge";
import { formatRelative } from "@/client/lib/format";
import type { ActionLog } from "@/shared/types/models";

interface Props {
  logs: ActionLog[];
}

export function RecentActivityList({ logs }: Props) {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  return (
    <Card>
      <CardHeader className="pb-2 flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium">
          {t("recentActivity")}
        </CardTitle>
        <Link
          href="/history"
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          {tc("viewAll")} <ArrowRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            {t("noRecentActions")}
          </p>
        ) : (
          <ul className="divide-y">
            {logs.map((log) => (
              <li key={log.id} className="py-2 flex items-center gap-3">
                <div className="w-20 shrink-0">
                  <ActionStatusBadge status={log.status} />
                </div>
                <div className="w-24 shrink-0">
                  <ActionTypeBadge action={log.action} />
                </div>
                <span className="text-sm truncate flex-1" title={log.title}>
                  {log.title}
                </span>
                <span
                  className="text-xs text-muted-foreground tabular-nums shrink-0"
                  title={new Date(
                    log.lastRetriedAt ?? log.createdAt,
                  ).toLocaleString()}
                >
                  {formatRelative(log.lastRetriedAt ?? log.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
