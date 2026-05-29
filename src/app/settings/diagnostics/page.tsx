"use client";
import { useTranslations } from "next-intl";
import { RefreshCw, Trash2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/client/components/ui/card";
import { Button } from "@/client/components/ui/button";
import { Metric } from "@/client/components/diagnostics/Metric";
import {
  useCacheStats,
  useClearCache,
} from "@/client/hooks/data/useCacheStats";
import { useConfirm } from "@/client/hooks/ui/useConfirm";
import { withToast } from "@/client/lib/with-toast";
import { formatBytes, formatRelative } from "@/client/lib/format";
import type { CacheStatsSnapshot } from "@/shared/types/api";

function formatHitRate(stats: CacheStatsSnapshot, emptyLabel: string): string {
  const total = stats.hits + stats.misses;
  if (total === 0) return emptyLabel;
  return `${Math.round((stats.hits / total) * 100)}%`;
}

export default function DiagnosticsSettingsPage() {
  const t = useTranslations("diagnostics");
  const tToast = useTranslations("diagnostics.toast");
  const tConfirm = useTranslations("diagnostics.confirm");
  const { data, isLoading, isError, refetch } = useCacheStats();
  const clear = useClearCache();
  const { confirm: askConfirm, dialog: confirmDialog } = useConfirm();

  const runClear = withToast(clear, {
    success: tToast("cleared"),
    error: tToast("clearFailed"),
  });

  const handleClear = async () => {
    const ok = await askConfirm({
      title: tConfirm("title"),
      body: tConfirm("body"),
      confirmLabel: tConfirm("confirmLabel"),
      destructive: true,
    });
    if (!ok) return;
    await runClear();
  };

  const empty = t("metrics.empty");
  const never = t("metrics.never");

  const stats = data ?? null;
  const oldestLabel =
    stats?.oldestEntryAtMs == null
      ? empty
      : formatRelative(stats.oldestEntryAtMs);
  const invalidatedLabel =
    stats?.lastInvalidatedAtMs == null
      ? never
      : formatRelative(stats.lastInvalidatedAtMs);

  return (
    <section className="space-y-section">
      <h2 className="text-lg font-semibold">{t("title")}</h2>
      <p className="text-muted-foreground text-sm">{t("subtitle")}</p>

      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-section">
          <div className="gap-section grid grid-cols-2 sm:grid-cols-4">
            <Metric
              label={t("metrics.entries")}
              value={
                stats
                  ? t("metrics.ofMax", {
                      current: stats.entries,
                      max: stats.maxEntries,
                    })
                  : empty
              }
            />
            <Metric
              label={t("metrics.memory")}
              value={
                stats
                  ? `${formatBytes(stats.sizeBytes)} / ${formatBytes(stats.maxSizeBytes)}`
                  : empty
              }
            />
            <Metric
              label={t("metrics.hitRate")}
              value={stats ? formatHitRate(stats, empty) : empty}
            />
            <Metric
              label={t("metrics.inflight")}
              value={stats ? String(stats.inflightCount) : empty}
            />
          </div>

          <div className="pt-section border-t">
            <div className="gap-subgroup grid grid-cols-1 text-sm sm:grid-cols-2">
              <div>
                <span className="text-muted-foreground">
                  {t("metrics.hits")}:{" "}
                </span>
                <span className="tabular-nums">
                  {stats ? stats.hits.toLocaleString() : empty}
                </span>
                <span className="text-muted-foreground ml-3">
                  {t("metrics.misses")}:{" "}
                </span>
                <span className="tabular-nums">
                  {stats ? stats.misses.toLocaleString() : empty}
                </span>
                <span className="text-muted-foreground ml-3">
                  {t("metrics.evictions")}:{" "}
                </span>
                <span className="tabular-nums">
                  {stats ? stats.evictions.toLocaleString() : empty}
                </span>
              </div>
              <div className="text-muted-foreground text-xs sm:text-right">
                {t("metrics.oldest")}: {oldestLabel}
                <span className="mx-2">·</span>
                {t("metrics.lastInvalidated")}: {invalidatedLabel}
              </div>
            </div>
          </div>

          <div className="pt-section flex justify-end gap-2 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refetch()}
              disabled={isLoading}
            >
              <RefreshCw className="mr-1.5 size-3.5" />
              {t("actions.refresh")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClear}
              // Don't gate solely on entries: clear() also resets the
              // hit/miss/eviction counters and drops any in-flight
              // rebuild slots. A cold cache (entries=0) can still have
              // misses to reset or an active rebuild to cancel — disabling
              // would strand that state.
              disabled={clear.isPending || stats === null}
            >
              <Trash2 className="text-destructive mr-1.5 size-3.5" />
              {t("actions.clear")}
            </Button>
          </div>

          {isError && (
            <p className="text-critical text-sm">
              {/* Falls through to the generic error toast already triggered
                  by api.ts; this inline line just confirms the card itself
                  is in a failure state. */}
              {t("metrics.empty")}
            </p>
          )}
        </CardContent>
      </Card>

      {confirmDialog}
    </section>
  );
}
