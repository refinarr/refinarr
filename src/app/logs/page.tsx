"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Trash2, Search, Wifi, WifiOff } from "lucide-react";
import { AppShell } from "@/client/components/layout/AppShell";
import { PageErrorBoundary } from "@/client/components/states/PageErrorBoundary";
import { AppLogRow } from "@/client/components/logs/AppLogRow";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/client/components/ui/select";
import { useAppLogs, useClearAppLogs } from "@/client/hooks/data/useAppLogs";
import { useDebouncedValue } from "@/client/hooks/ui/useDebouncedValue";
import { useConfirm } from "@/client/hooks/ui/useConfirm";
import { useConfig } from "@/client/hooks/data/useConfig";
import { withToast } from "@/client/lib/with-toast";
import { LogSource } from "@/server/lib/log-sources";
import type { LogLevel } from "@/shared/types/models";

const ALL = "__all__";

export default function LogsPage() {
  const t = useTranslations("logs");
  const tLevel = useTranslations("logs.levelLabels");
  const tCols = useTranslations("logs.columns");
  const tToast = useTranslations("toast.logs");
  const tConfirm = useTranslations("confirm.clearLogs");
  const { data: config } = useConfig();
  const isDebug = config?.debugMode ?? false;
  const [level, setLevel] = useState<LogLevel>("info");
  const [source, setSource] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q, 300);

  const { entries, total, isLoading, isConnected, reconnect } = useAppLogs({
    level: level,
    source: source ?? undefined,
    q: debouncedQ || undefined,
  });

  const clear = useClearAppLogs();
  const { confirm: askConfirm, dialog: confirmDialog } = useConfirm();
  const runClear = withToast(clear, {
    success: tToast("cleared"),
    error: tToast("clearFailed"),
  });

  const handleClear = async () => {
    const ok = await askConfirm({
      title: tConfirm("title"),
      body: tConfirm("body"),
      confirmLabel: t("clearAll"),
      destructive: true,
    });
    if (!ok) return;
    await runClear();
    reconnect();
  };

  const levelLabel = tLevel(level);
  const SOURCE_LABELS: Record<string, string> = {
    [LogSource.Api]: t("source.api"),
    [LogSource.Client]: t("source.client"),
    [LogSource.Auth]: t("source.auth"),
    [LogSource.Db]: t("source.db"),
    [LogSource.ArrClient]: t("source.arr-client"),
    [LogSource.InstanceService]: t("source.instance-service"),
    [LogSource.MovieService]: t("source.movie-service"),
    [LogSource.SeriesService]: t("source.series-service"),
    [LogSource.MediaAction]: t("source.media-action"),
    [LogSource.SearchQueue]: t("source.search-queue"),
    [LogSource.SearchWorker]: t("source.search-worker"),
    [LogSource.StatusPoller]: t("source.status-poller"),
    [LogSource.AutoRun]: t("source.auto-run"),
  };
  const sourceLabel =
    source === null ? t("sourceAll") : (SOURCE_LABELS[source] ?? source);

  return (
    <AppShell>
      <PageErrorBoundary>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">{t("title")}</h1>
              <p className="text-muted-foreground mt-1 flex items-center gap-1.5 text-sm">
                {isConnected ? (
                  <Wifi className="text-ok size-3" />
                ) : (
                  <WifiOff className="text-critical size-3" />
                )}
                {isConnected ? t("live") : t("reconnecting")}
                {total > 0 && (
                  <span className="ml-1">
                    · {t("entries", { count: total })}
                  </span>
                )}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleClear}
                disabled={total === 0 || clear.isPending}
              >
                <Trash2 className="text-destructive mr-1 size-3.5" />
                {t("clearAll")}
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-64 flex-1">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("searchPlaceholder")}
                className="pl-9"
              />
            </div>
            <Select
              value={level}
              onValueChange={(v) => setLevel(v as LogLevel)}
            >
              <SelectTrigger className="w-32">
                <SelectValue>{levelLabel}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {isDebug && (
                  <SelectItem value="debug">{tLevel("debug")}</SelectItem>
                )}
                <SelectItem value="info">{tLevel("info")}</SelectItem>
                <SelectItem value="warn">{tLevel("warn")}</SelectItem>
                <SelectItem value="error">{tLevel("error")}</SelectItem>
              </SelectContent>
            </Select>
            {isDebug && (
              <Select
                value={source ?? ALL}
                onValueChange={(v) => setSource(v === ALL ? null : v)}
              >
                <SelectTrigger className="w-36">
                  <SelectValue>{sourceLabel}</SelectValue>
                </SelectTrigger>
                <SelectContent className="w-max">
                  <SelectItem value={ALL}>{t("sourceAll")}</SelectItem>
                  {Object.values(LogSource).map((s) => (
                    <SelectItem key={s} value={s}>
                      {SOURCE_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {isLoading && (
            <div className="flex justify-center py-8">
              <Loader2 className="text-muted-foreground size-5 animate-spin" />
            </div>
          )}

          {!isLoading && entries.length === 0 && (
            <div className="text-muted-foreground rounded-lg border p-8 text-center text-sm">
              {t("empty")}
            </div>
          )}

          {!isLoading && entries.length > 0 && (
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-background border-b">
                  <tr className="text-muted-foreground text-left text-xs tracking-wide uppercase">
                    <th className="w-6 px-3 py-2.5" />
                    <th className="w-44 px-3 py-2.5 font-medium">
                      {tCols("time")}
                    </th>
                    <th className="w-20 px-3 py-2.5 font-medium">
                      {tCols("level")}
                    </th>
                    <th className="w-32 px-3 py-2.5 font-medium">
                      {tCols("source")}
                    </th>
                    <th className="px-3 py-2.5 font-medium">
                      {tCols("message")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <AppLogRow key={entry.id} entry={entry} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {confirmDialog}
        </div>
      </PageErrorBoundary>
    </AppShell>
  );
}
