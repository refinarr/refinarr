"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Trash2, Search, Wifi, WifiOff, Play } from "lucide-react";
import { AppShell } from "@/client/components/layout/AppShell";
import { PageErrorBoundary } from "@/client/components/states/PageErrorBoundary";
import { LogList } from "@/client/components/logs/LogList";
import { LogDetailPanel } from "@/client/components/logs/LogDetailPanel";
import {
  LogFilterChips,
  useLogFilterChips,
} from "@/client/components/logs/LogFilterChips";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/client/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/client/components/ui/sheet";
import { useAppLogs, useClearAppLogs } from "@/client/hooks/data/useAppLogs";
import { useDebouncedValue } from "@/client/hooks/ui/useDebouncedValue";
import { useConfirm } from "@/client/hooks/ui/useConfirm";
import { useConfig } from "@/client/hooks/data/useConfig";
import { useInstances } from "@/client/hooks/data/useInstances";
import { useIsDesktop } from "@/client/hooks/ui/useMediaQuery";
import { useLogUrlState } from "@/client/hooks/ui/useLogUrlState";
import { useAutoScrollOnPrepend } from "@/client/hooks/ui/useAutoScrollOnPrepend";
import { withToast } from "@/client/lib/with-toast";
import { LogSource } from "@/shared/types/models";
import type { AppLogEntry, LogLevel } from "@/shared/types/models";
import { isLogLevel } from "@/shared/log-level";

const ALL = "__all__";
const ALL_LEVELS = "__all__";

// Suspense fallback for the boundary below. Matches the in-page
// loading spinner so a refresh/prerender doesn't show a different
// loading affordance than the SSE warmup branch already uses.
function LogsPageFallback() {
  return (
    <div className="flex justify-center py-8">
      <Loader2 className="text-muted-foreground size-5 animate-spin" />
    </div>
  );
}

export default function LogsPage() {
  // Suspense wraps LogsPageBody because `useLogUrlState()` reaches into
  // `useSearchParams()`, which Next.js 16's static prerender treats as a
  // CSR-bailout source. Without the boundary `next build` fails on
  // `/logs` (Playwright catches this; dev server doesn't).
  //
  // AppShell + PageErrorBoundary stay OUTSIDE Suspense so the chrome
  // (sidebar, top header, tab bar) remains prerenderable; only the body
  // that depends on URL state is suspended.
  return (
    <AppShell scrollMode="viewport">
      <PageErrorBoundary>
        <Suspense fallback={<LogsPageFallback />}>
          <LogsPageBody />
        </Suspense>
      </PageErrorBoundary>
    </AppShell>
  );
}

function LogsPageBody() {
  const t = useTranslations("logs");
  const tLevel = useTranslations("logs.levelLabels");
  const tToast = useTranslations("toast.logs");
  const tConfirm = useTranslations("confirm.clearLogs");
  const tDetail = useTranslations("logs.detail");

  const { data: config } = useConfig();
  const isDebug = config?.debugMode ?? false;
  const isDesktop = useIsDesktop();
  const { data: instances } = useInstances();

  const {
    level,
    source,
    instanceId,
    q,
    setLevel,
    setSource,
    setInstanceId,
    setQ,
    clearAll,
  } = useLogUrlState();

  // `draftQ` mirrors the input box; the URL is the canonical state.
  // External nav (e.g. landing on `/logs?q=foo`) flows into the input;
  // typing flows into the URL via the debounced effect below.
  const [draftQ, setDraftQ] = useState(q);
  useEffect(() => {
    // Sync from URL to input on external URL changes (back/forward nav,
    // dashboard link). This is a subscribe-to-external pattern, not a
    // render-time derivation.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraftQ(q);
  }, [q]);
  const debouncedDraft = useDebouncedValue(draftQ, 300);
  useEffect(() => {
    if (debouncedDraft !== q) setQ(debouncedDraft);
  }, [debouncedDraft, q, setQ]);

  const activeLevel: LogLevel | null =
    !isDebug && level === "debug" ? null : level;
  const activeSource = isDebug ? source : null;
  const activeInstanceId = instanceId;

  const { entries, total, isLoading, isConnected, reconnect } = useAppLogs({
    level: activeLevel ?? undefined,
    source: activeSource ?? undefined,
    instanceId: activeInstanceId ?? undefined,
    q: q || undefined,
  });

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selectedEntry: AppLogEntry | null =
    selectedId !== null
      ? (entries.find((e) => e.id === selectedId) ?? null)
      : null;

  const [autoScroll, setAutoScroll] = useState(true);
  const listScrollRef = useRef<HTMLDivElement | null>(null);
  const { paused, resume } = useAutoScrollOnPrepend({
    containerRef: listScrollRef,
    items: entries,
    enabled: autoScroll,
  });

  const chips = useLogFilterChips({
    level: activeLevel,
    source: activeSource,
    instanceId: activeInstanceId,
    q,
    instances,
    setLevel,
    setSource,
    setInstanceId,
    setQ,
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

  return (
    // AppShell + PageErrorBoundary live in the outer `LogsPage` (above
    // the Suspense boundary). This body component owns only the
    // content; scrollMode + chrome are the outer concern.
    <div className="flex h-full min-h-0 flex-col gap-4 px-4 pt-4 pb-[calc(var(--spacing-bottom-bar)+env(safe-area-inset-bottom))] md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
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
              <span className="ml-1">· {t("entries", { count: total })}</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={autoScroll && !paused ? "default" : "outline"}
            size="sm"
            onClick={() => {
              if (paused) {
                resume();
              } else {
                setAutoScroll((v) => !v);
              }
            }}
          >
            <Play className="mr-1.5 size-3.5" />
            {t("autoScroll.label")}
          </Button>
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
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-64 flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={draftQ}
            onChange={(e) => setDraftQ(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="pl-9"
          />
        </div>
        <Select
          value={activeLevel ?? ALL_LEVELS}
          onValueChange={(v) => {
            if (v === null || v === ALL_LEVELS) setLevel(null);
            else if (isLogLevel(v)) setLevel(v);
          }}
        >
          <SelectTrigger className="w-36">
            <SelectValue>
              {activeLevel === null ? tLevel("all") : tLevel(activeLevel)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_LEVELS}>{tLevel("all")}</SelectItem>
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
            value={activeSource ?? ALL}
            onValueChange={(v) => setSource(v === null || v === ALL ? null : v)}
          >
            <SelectTrigger className="w-36">
              <SelectValue>
                {activeSource === null
                  ? t("sourceAll")
                  : (SOURCE_LABELS[activeSource] ?? activeSource)}
              </SelectValue>
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
        <Select
          value={activeInstanceId ? String(activeInstanceId) : ALL}
          onValueChange={(v) =>
            setInstanceId(v === null || v === ALL ? null : Number(v) || null)
          }
        >
          <SelectTrigger className="w-40">
            <SelectValue>
              {activeInstanceId
                ? (instances?.find((i) => i.id === activeInstanceId)?.name ??
                  `#${activeInstanceId}`)
                : t("instanceAll")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("instanceAll")}</SelectItem>
            {instances?.map((i) => (
              <SelectItem key={i.id} value={String(i.id)}>
                {i.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <LogFilterChips chips={chips} onClearAll={clearAll} />

      {isLoading && (
        <div className="flex justify-center py-8">
          <Loader2 className="text-muted-foreground size-5 animate-spin" />
        </div>
      )}

      {!isLoading && entries.length === 0 && (
        <div className="text-muted-foreground rounded-lg border p-8 text-center text-sm">
          {chips.length > 0 ? t("noMatches") : t("empty")}
        </div>
      )}

      {!isLoading && entries.length > 0 && (
        <div className="min-h-0 flex-1" aria-label={t("title")}>
          <LogList
            entries={entries}
            selectedId={selectedId}
            onSelect={setSelectedId}
            scrollContainerRef={listScrollRef}
          />
        </div>
      )}

      <Sheet
        open={selectedEntry !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      >
        <SheetContent
          side={isDesktop ? "right" : "bottom"}
          // Bottom variant: Sheet primitive defaults to
          // `data-[side=bottom]:h-auto`, which beats a plain
          // `h-[85vh]` by selector specificity. Re-state the
          // height with the same data-attr variant so the panel
          // is bound to 85vh and its inner body can scroll
          // instead of overflowing the viewport.
          className={
            isDesktop
              ? "bg-background flex size-full max-w-2xl flex-col overflow-hidden p-0 sm:max-w-2xl"
              : "bg-background flex flex-col overflow-hidden p-0 data-[side=bottom]:h-[85vh] data-[side=bottom]:max-h-[85vh]"
          }
        >
          <SheetHeader className="sr-only">
            <SheetTitle>{tDetail("context")}</SheetTitle>
          </SheetHeader>
          <LogDetailPanel
            entry={selectedEntry}
            onClose={() => setSelectedId(null)}
          />
        </SheetContent>
      </Sheet>

      {confirmDialog}
    </div>
  );
}
