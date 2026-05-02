"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { AppShell } from "@/client/components/layout/AppShell";
import { PageErrorBoundary } from "@/client/components/states/PageErrorBoundary";
import { AppLogRow } from "@/client/components/logs/AppLogRow";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/client/components/ui/select";
import { useAppLogs, useClearAppLogs } from "@/client/hooks/useAppLogs";
import { useDebouncedValue } from "@/client/hooks/useDebouncedValue";
import { useConfirm } from "@/client/hooks/useConfirm";
import { withToast } from "@/client/lib/with-toast";
import type { LogLevel } from "@/shared/types/models";
import { Loader2, Trash2, Search, Wifi, WifiOff } from "lucide-react";

const ALL = "__all__";

export default function LogsPage() {
  const t = useTranslations("logs");
  const tLevel = useTranslations("logs.levelLabels");
  const tCols = useTranslations("logs.columns");
  const tToast = useTranslations("toast.logs");
  const tConfirm = useTranslations("confirm.clearLogs");
  const [level, setLevel] = useState<LogLevel | null>(null);
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q, 300);

  const { entries, total, isLoading, isConnected, reconnect } = useAppLogs({
    level: level ?? undefined,
    q: debouncedQ || undefined,
  });

  const clear = useClearAppLogs();
  const { confirm: askConfirm, dialog: confirmDialog } = useConfirm();
  const runClear = withToast(clear, { success: tToast("cleared"), error: tToast("clearFailed") });

  const handleClear = async () => {
    const ok = await askConfirm({
      title: tConfirm("title"),
      body: tConfirm("body"),
      confirmLabel: t("clearAll"),
      destructive: true,
    });
    if (!ok) return;
    await runClear(undefined as unknown as void);
    reconnect();
  };

  const levelLabel = level === null ? tLevel("all") : tLevel(level);

  return (
    <AppShell>
      <PageErrorBoundary>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">{t("title")}</h1>
              <p className="text-muted-foreground text-sm mt-1 flex items-center gap-1.5">
                {isConnected ? (
                  <Wifi className="h-3 w-3 text-green-500" />
                ) : (
                  <WifiOff className="h-3 w-3 text-destructive" />
                )}
                {isConnected ? t("live") : t("reconnecting")}
                {total > 0 && <span className="ml-1">· {t("entries", { count: total })}</span>}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleClear}
                disabled={total === 0 || clear.isPending}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1 text-destructive" />
                {t("clearAll")}
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("searchPlaceholder")}
                className="pl-9"
              />
            </div>
            <Select
              value={level ?? ALL}
              onValueChange={(v) => setLevel(v === ALL ? null : (v as LogLevel))}
            >
              <SelectTrigger className="w-32">
                <SelectValue>{levelLabel}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{tLevel("all")}</SelectItem>
                <SelectItem value="error">{tLevel("error")}</SelectItem>
                <SelectItem value="warn">{tLevel("warn")}</SelectItem>
                <SelectItem value="info">{tLevel("info")}</SelectItem>
                <SelectItem value="debug">{tLevel("debug")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!isLoading && entries.length === 0 && (
            <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
              {t("empty")}
            </div>
          )}

          {!isLoading && entries.length > 0 && (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-background border-b">
                  <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="w-6 px-3 py-2.5" />
                    <th className="w-44 px-3 py-2.5 font-medium">{tCols("time")}</th>
                    <th className="w-20 px-3 py-2.5 font-medium">{tCols("level")}</th>
                    <th className="w-32 px-3 py-2.5 font-medium">{tCols("source")}</th>
                    <th className="px-3 py-2.5 font-medium">{tCols("message")}</th>
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
