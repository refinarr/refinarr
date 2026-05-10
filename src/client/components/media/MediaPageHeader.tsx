"use client";
import { useTranslations } from "next-intl";
import { Loader2, RefreshCw, Rows3, Rows4 } from "lucide-react";
import { Button } from "@/client/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/client/components/ui/select";
import { Label } from "@/client/components/ui/label";
import { ScoringModeSelector } from "@/client/components/settings/ScoringModeSelector";
import { InstanceConnectionDot } from "@/client/components/common/InstanceConnectionDot";
import { useDensity } from "@/client/hooks/ui/useDensity";
import { cn } from "@/client/lib/utils";
import { DEFAULT_SCORING_MODE } from "@/shared/scoring-mode";
import type { PublicInstance } from "@/shared/types/api";
import type { ScoringMode } from "@/shared/types/models";

interface Props {
  title: string;
  total: number;
  selected: number;
  activeInstance: number;
  activeInstanceName: string | null;
  typedInstances: PublicInstance[];
  onSetInstance: (id: number) => void;
  onRefresh: () => void;
  refreshPending: boolean;
  isLoading: boolean;
  isFetching: boolean;
}

export function MediaPageHeader({
  title,
  total,
  selected,
  activeInstance,
  activeInstanceName,
  typedInstances,
  onSetInstance,
  onRefresh,
  refreshPending,
  isLoading,
  isFetching,
}: Props) {
  const tInstSel = useTranslations("instanceSelector");
  const tCommon = useTranslations("common");
  const tScoringOpts = useTranslations("settings.scoringModeOptions");
  const tDensity = useTranslations("filters.density");
  const { density, setDensity } = useDensity();

  const showSwitcher = typedInstances.length > 1;
  const showInstanceContext = activeInstance > 0 && !!activeInstanceName;

  const mode: ScoringMode =
    typedInstances.find((i) => i.id === activeInstance)?.scoringMode ??
    DEFAULT_SCORING_MODE;

  return (
    <div className="space-y-3">
      {showInstanceContext && (
        <div className="border-primary/30 bg-primary/10 flex flex-wrap items-center justify-between gap-3 rounded-md border px-4 py-2">
          <div className="flex items-center gap-2 text-sm">
            <InstanceConnectionDot instanceId={activeInstance} />
            <span className="text-primary font-semibold">
              {activeInstanceName}
            </span>
            <span className="text-muted-foreground/60" aria-hidden>
              ·
            </span>
            <span className="text-muted-foreground">
              {tInstSel("scoringModeBanner", { mode: tScoringOpts(mode) })}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={refreshPending}
            className="border-primary/40 text-primary hover:bg-primary/10 hover:text-primary"
          >
            <RefreshCw
              className={cn("size-4", refreshPending && "animate-spin")}
            />
            {tCommon("refresh")}
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">{title}</h1>
          {!isLoading && (
            <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
              {tInstSel("flaggedSummary", { total, selected })}
              {isFetching && <Loader2 className="size-3 animate-spin" />}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {showSwitcher && (
            <div className="flex items-center gap-2">
              <Label>{tInstSel("instanceLabel")}</Label>
              <Select
                value={String(activeInstance)}
                onValueChange={(v) => onSetInstance(Number(v ?? 0))}
              >
                <SelectTrigger className="w-44" data-testid="instance-switcher">
                  <SelectValue>
                    {activeInstanceName ?? tInstSel("selectInstance")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {typedInstances.map((i) => (
                    <SelectItem key={i.id} value={String(i.id)}>
                      {i.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {showInstanceContext && (
            <ScoringModeSelector instanceId={activeInstance} />
          )}
          <div
            role="group"
            aria-label={tDensity("groupLabel")}
            className="border-input bg-background hidden rounded-md border md:inline-flex"
          >
            <button
              type="button"
              aria-pressed={density === "cozy"}
              onClick={() => setDensity("cozy")}
              title={tDensity("cozy")}
              className={cn(
                "h-control-sm inline-flex items-center px-2 transition-colors",
                density === "cozy"
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:bg-accent/50",
              )}
            >
              <Rows3 className="size-4" aria-hidden />
              <span className="sr-only">{tDensity("cozy")}</span>
            </button>
            <button
              type="button"
              aria-pressed={density === "compact"}
              onClick={() => setDensity("compact")}
              title={tDensity("compact")}
              className={cn(
                "h-control-sm inline-flex items-center px-2 transition-colors",
                density === "compact"
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:bg-accent/50",
              )}
            >
              <Rows4 className="size-4" aria-hidden />
              <span className="sr-only">{tDensity("compact")}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
