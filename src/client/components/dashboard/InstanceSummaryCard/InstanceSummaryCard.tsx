"use client";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight, Settings } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/client/components/ui/card";
import { Badge } from "@/client/components/ui/badge";
import { InstanceErrorSummary } from "@/client/components/history/InstanceErrorSummary";
import { useInstanceHealth } from "@/client/hooks/useInstances";
import type { DashboardInstanceSummary } from "@/shared/types/api";

interface Props {
  instance: DashboardInstanceSummary;
}

export function InstanceSummaryCard({ instance }: Props) {
  const t = useTranslations("dashboard.instanceCard");
  const { data: health, isLoading: healthLoading, isError: healthError } = useInstanceHealth(instance.id);
  const healthy = !healthError && health?.ok === true;
  const dotClass = !instance.enabled
    ? "bg-muted-foreground"
    : healthLoading
    ? "bg-muted-foreground animate-pulse"
    : healthy
    ? "bg-green-500"
    : "bg-red-500";
  const healthLabel = !instance.enabled
    ? t("disabled")
    : healthLoading
    ? t("checking")
    : healthy
    ? t("connected")
    : t("unreachable");

  const libraryHref = instance.type === "radarr" ? "/movies" : "/shows";
  const flaggedNounKey = instance.type === "radarr" ? "flaggedMoviesNoun" : "flaggedSeriesNoun";

  return (
    <Card className={!instance.enabled ? "opacity-60" : ""}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${dotClass}`} title={healthLabel} />
          <Badge variant="outline" className="capitalize">{instance.type}</Badge>
          <span className="font-medium truncate">{instance.name}</span>
          {!instance.enabled && <Badge variant="secondary">{t("disabled")}</Badge>}
        </div>
        <p className="text-xs text-muted-foreground mt-1">{healthLabel}</p>
      </CardHeader>
      <CardContent className="space-y-2">
        <Link
          href={`${libraryHref}?instanceId=${instance.id}`}
          className="flex items-center justify-between rounded-md border bg-muted/20 px-3 py-2 hover:bg-muted/40 transition-colors"
        >
          <span className="text-sm flex items-baseline gap-1">
            <span className="text-2xl font-bold tabular-nums">{instance.flaggedCount}</span>
            <span className="text-muted-foreground">
              {t(flaggedNounKey, { count: instance.flaggedCount })}
            </span>
          </span>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </Link>

        <div className="flex items-center text-xs">
          <InstanceErrorSummary instanceId={instance.id} />
          <Link
            href="/settings"
            className="ml-auto flex items-center gap-1 text-muted-foreground hover:text-foreground"
          >
            <Settings className="h-3 w-3" /> {t("settings")}
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
