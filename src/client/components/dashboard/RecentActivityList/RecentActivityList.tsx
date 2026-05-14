"use client";
import Link from "next/link";
import { useMemo } from "react";
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
import { mediaFocusPath } from "@/client/lib/media-link";
import { useInstances } from "@/client/hooks/data/useInstances";
import type { ActionLog, ArrType } from "@/shared/types/models";

interface Props {
  logs: ActionLog[];
}

export function RecentActivityList({ logs }: Props) {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const { data: instances } = useInstances();
  const instanceTypeMap = useMemo(() => {
    const map = new Map<number, ArrType>();
    for (const i of instances ?? []) map.set(i.id, i.type);
    return map;
  }, [instances]);
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">
          {t("recentActivity")}
        </CardTitle>
        <Link
          href="/history"
          className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs"
        >
          {tc("viewAll")} <ArrowRight className="size-3" />
        </Link>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center text-sm">
            {t("noRecentActions")}
          </p>
        ) : (
          <ul className="divide-y">
            {logs.map((log) => {
              const instanceType = instanceTypeMap.get(log.instanceId);
              const titleNode = instanceType ? (
                <Link
                  href={mediaFocusPath({
                    instanceType,
                    instanceId: log.instanceId,
                    mediaId: log.mediaId,
                  })}
                  className="hover:text-brand flex-1 truncate text-sm hover:underline"
                  title={log.title}
                >
                  {log.title}
                </Link>
              ) : (
                <span className="flex-1 truncate text-sm" title={log.title}>
                  {log.title}
                </span>
              );
              return (
                <li key={log.id} className="flex items-center gap-3 py-2">
                  <div className="w-20 shrink-0">
                    <ActionStatusBadge status={log.status} />
                  </div>
                  <div className="w-24 shrink-0">
                    <ActionTypeBadge action={log.action} />
                  </div>
                  {titleNode}
                  <span
                    className="text-muted-foreground shrink-0 text-xs tabular-nums"
                    title={new Date(
                      log.lastRetriedAt ?? log.createdAt,
                    ).toLocaleString()}
                  >
                    {formatRelative(log.lastRetriedAt ?? log.createdAt)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
