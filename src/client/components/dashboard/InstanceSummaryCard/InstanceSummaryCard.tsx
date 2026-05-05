"use client";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight, Settings } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/client/components/ui/card";
import { Badge } from "@/client/components/ui/badge";
import { InstanceErrorSummary } from "@/client/components/history/InstanceErrorSummary";
import { useInstanceHealth } from "@/client/hooks/data/useInstances";
import type { DashboardInstanceSummary } from "@/shared/types/api";
import type { ArrType } from "@/shared/types/models";

// Type-keyed mapping for the per-type bits of the dashboard card. Adding
// Lidarr / Whisparr means dropping a third entry — the rest of the card
// is type-agnostic.
const PER_TYPE: Record<ArrType, { libraryHref: string; nounKey: "flaggedMoviesNoun" | "flaggedSeriesNoun" }> = {
  radarr: { libraryHref: "/movies", nounKey: "flaggedMoviesNoun" },
  sonarr: { libraryHref: "/shows", nounKey: "flaggedSeriesNoun" },
};

interface Props {
  instance: DashboardInstanceSummary;
}

type HealthState = "disabled" | "checking" | "connected" | "unreachable";

const DOT_CLASS: Record<HealthState, string> = {
  disabled: "bg-muted-foreground",
  checking: "bg-muted-foreground animate-pulse",
  connected: "bg-green-500",
  unreachable: "bg-red-500",
};

// Translation key suffix under `dashboard.instanceCard.*`.
const LABEL_KEY: Record<HealthState, string> = {
  disabled: "disabled",
  checking: "checking",
  connected: "connected",
  unreachable: "unreachable",
};

function getHealthState(enabled: boolean, isLoading: boolean, healthy: boolean): HealthState {
  if (!enabled) return "disabled";
  if (isLoading) return "checking";
  return healthy ? "connected" : "unreachable";
}

export function InstanceSummaryCard({ instance }: Props) {
  const t = useTranslations("dashboard.instanceCard");
  const { data: health, isLoading: healthLoading, isError: healthError } = useInstanceHealth(instance.id);
  const healthy = !healthError && health?.ok === true;
  const state = getHealthState(instance.enabled, healthLoading, healthy);
  const dotClass = DOT_CLASS[state];
  const healthLabel = t(LABEL_KEY[state]);

  const { libraryHref, nounKey: flaggedNounKey } = PER_TYPE[instance.type];

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
            {instance.flaggedCount === null ? (
              <>
                <span className="text-2xl font-bold tabular-nums text-muted-foreground">—</span>
                <span className="text-muted-foreground">{t(flaggedNounKey, { count: 0 })}</span>
              </>
            ) : (
              <>
                <span className="text-2xl font-bold tabular-nums">{instance.flaggedCount}</span>
                <span className="text-muted-foreground">
                  {t(flaggedNounKey, { count: instance.flaggedCount })}
                </span>
              </>
            )}
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
