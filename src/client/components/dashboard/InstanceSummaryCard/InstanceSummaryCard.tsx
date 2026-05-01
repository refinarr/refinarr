"use client";
import Link from "next/link";
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
    ? "Disabled"
    : healthLoading
    ? "Checking…"
    : healthy
    ? "Connected"
    : "Unreachable";

  const libraryHref = instance.type === "radarr" ? "/movies" : "/shows";
  const itemLabel = instance.type === "radarr" ? "movies" : "series";

  return (
    <Card className={!instance.enabled ? "opacity-60" : ""}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${dotClass}`} title={healthLabel} />
          <Badge variant="outline" className="capitalize">{instance.type}</Badge>
          <span className="font-medium truncate">{instance.name}</span>
          {!instance.enabled && <Badge variant="secondary">Disabled</Badge>}
        </div>
        <p className="text-xs text-muted-foreground mt-1">{healthLabel}</p>
      </CardHeader>
      <CardContent className="space-y-2">
        <Link
          href={`${libraryHref}?instanceId=${instance.id}`}
          className="flex items-center justify-between rounded-md border bg-muted/20 px-3 py-2 hover:bg-muted/40 transition-colors"
        >
          <span className="text-sm">
            <span className="text-2xl font-bold tabular-nums">{instance.flaggedCount}</span>{" "}
            <span className="text-muted-foreground">flagged {itemLabel}</span>
          </span>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </Link>

        <div className="flex items-center justify-between text-xs">
          <InstanceErrorSummary instanceId={instance.id} />
          <Link
            href="/settings"
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
          >
            <Settings className="h-3 w-3" /> Settings
          </Link>
        </div>

        {!instance.hasPreferences && instance.enabled && (
          <p className="text-xs text-yellow-400">No Custom Formats configured</p>
        )}
      </CardContent>
    </Card>
  );
}
