"use client";
import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { AppShell } from "@/client/components/layout/AppShell";
import { BulkActionToolbar, type BulkProgress } from "@/client/components/media/BulkActionToolbar";
import { MediaTableSkeleton } from "@/client/components/media/MediaTableSkeleton";
import { MediaPageHeader } from "@/client/components/media/MediaPageHeader";
import { MediaSearchBar } from "@/client/components/media/MediaSearchBar";
import { MediaTable, type ColumnDef } from "@/client/components/media/MediaTable";
import { ActiveFilterChips } from "@/client/components/common/ActiveFilterChips";
import { RowHoverActions } from "@/client/components/common/RowHoverActions";
import { NoInstancesPrompt } from "@/client/components/states/NoInstancesPrompt";
import { MediaErrorCard } from "@/client/components/states/MediaErrorCard";
import { MediaPageEmptyState } from "@/client/components/states/MediaPageEmptyState";
import { PageErrorBoundary } from "@/client/components/states/PageErrorBoundary";
import { usePreferences } from "@/client/hooks/data/usePreferences";
import { useQualityProfiles } from "@/client/hooks/data/useQualityProfiles";
import { useRefreshInstance } from "@/client/hooks/data/useRefreshInstance";
import { useQueuedMediaIds } from "@/client/hooks/data/useSearchQueue";
import { useRecentSearchMap } from "@/client/hooks/data/useRecentSearches";
import { useConfirm } from "@/client/hooks/ui/useConfirm";
import { useInfiniteScroll } from "@/client/hooks/ui/useInfiniteScroll";
import { useInstanceSelection } from "@/client/hooks/media/useInstanceSelection";
import { useMediaFilters } from "@/client/hooks/media/useMediaFilters";
import { useFilterChips } from "@/client/hooks/media/useFilterChips";
import { useMediaSelection } from "@/client/hooks/media/useMediaSelection";
import { useDetailDrawer } from "@/client/hooks/media/useDetailDrawer";
import {
  useFlaggedMediaData,
  type FlaggedMediaQueryHook,
} from "@/client/hooks/media/useFlaggedMediaData";
import { useBulkAbort } from "@/client/hooks/media/useBulkAbort";
import { useBulkMediaActions, type BulkActionsConfig } from "@/client/hooks/media/useBulkMediaActions";
import { useBulkHandlers } from "@/client/hooks/media/useBulkHandlers";
import type {
  ArrType,
  FlaggedMedia,
  QualityProfile,
  ScoringMode,
} from "@/shared/types/models";

// Translation function returned by next-intl's useTranslations.
type TFn = ReturnType<typeof useTranslations>;

// Context handed to each per-domain render function. Carries everything the
// columns / cards / drawer need to render without re-running hooks.
export interface MediaListShellRenderCtx<T extends FlaggedMedia> {
  arrType: ArrType;
  scoringMode: ScoringMode;
  profiles: QualityProfile[] | undefined;
  activeInstance: number;
  queuedIds: Set<number>;
  recentMap: Map<number, Date>;
  refetch: () => unknown;
  runSearch: (item: T) => Promise<unknown>;
  runIgnore: (item: T) => Promise<unknown>;
  runDelete: (item: T, triggerSearch: boolean) => Promise<unknown>;
  t: TFn;
  tCols: TFn;
  tTime: TFn;
}

interface Props<T extends FlaggedMedia> {
  arrType: ArrType;
  bulkConfig: Pick<BulkActionsConfig<T>, "mediaType" | "search" | "ignore" | "delete">;
  // Hook factory passed in (useMovies, useSeries, …); the shell wraps it with
  // useFlaggedMediaData so domain pages don't each redeclare a wrapper.
  useQuery: FlaggedMediaQueryHook<T>;
  // Per-domain render functions. Each receives the same ctx so they can pull
  // exactly the bits they need.
  columns: (ctx: MediaListShellRenderCtx<T>) => ColumnDef<T>[];
  renderCard: (item: T, ctx: MediaListShellRenderCtx<T>) => ReactNode;
  renderDrawer: (item: T | null, ctx: MediaListShellRenderCtx<T>, close: () => void) => ReactNode;
  // i18n keys: the shell uses the page's namespace (movies / shows / future
  // music / anime) for title + columns subset, plus a separate confirm
  // namespace for bulk-delete dialog text.
  i18nNamespace: string;
  confirmDeleteBulkKey: string;
}

export function MediaListShell<T extends FlaggedMedia>({
  arrType,
  bulkConfig,
  useQuery,
  columns,
  renderCard,
  renderDrawer,
  i18nNamespace,
  confirmDeleteBulkKey,
}: Props<T>) {
  const t = useTranslations(i18nNamespace);
  const tCols = useTranslations(`${i18nNamespace}.columns`);
  const tConfirmDeleteBulk = useTranslations(confirmDeleteBulkKey);
  const tTime = useTranslations("time");
  const router = useRouter();

  const inst = useInstanceSelection(arrType);
  const { data: prefs } = usePreferences(inst.activeInstance);
  const { data: profiles } = useQualityProfiles(arrType, inst.activeInstance);
  const refreshMutation = useRefreshInstance();
  const { confirm: askConfirm, dialog: confirmDialog } = useConfirm();

  const scoringMode: ScoringMode =
    inst.typedInstances.find((i) => i.id === inst.activeInstance)?.scoringMode ?? "profile";
  const noCfsConfigured = scoringMode === "manual" && (prefs?.length ?? 0) === 0;

  const filters = useMediaFilters(scoringMode, inst.activeInstance);
  const data = useFlaggedMediaData<T>(useQuery, inst.activeInstance, filters.forQuery);
  const queuedIds = useQueuedMediaIds(inst.activeInstance);
  const recentMap = useRecentSearchMap(inst.activeInstance);
  const sentinelRef = useInfiniteScroll(data.fetchNextPage, data.hasNextPage);
  const selection = useMediaSelection<T>(data.items, bulkConfig.delete.isDeletable);
  const drawer = useDetailDrawer<T>(data.items);

  const [bulkProgress, setBulkProgress] = useState<BulkProgress | null>(null);
  const abort = useBulkAbort();
  const actions = useBulkMediaActions<T>({
    ...bulkConfig,
    instanceId: inst.activeInstance,
    setProgress: setBulkProgress,
    refetch: data.refetch,
  });
  const handlers = useBulkHandlers<T>({ selection, abort, actions });
  const { chips, clearActiveFilters } = useFilterChips({ filters, prefs, profiles });

  const ctx: MediaListShellRenderCtx<T> = {
    arrType,
    scoringMode,
    profiles,
    activeInstance: inst.activeInstance,
    queuedIds,
    recentMap,
    refetch: data.refetch,
    runSearch: (item) => actions.searchMutation.mutateAsync({ items: [item], isBulk: false }),
    runIgnore: (item) => actions.ignoreWithToast({ items: [item], isBulk: false }),
    runDelete: (item, triggerSearch) =>
      actions.deleteMutation.mutateAsync({ items: [item], isBulk: false, search: triggerSearch }),
    t,
    tCols,
    tTime,
  };

  if (!inst.loadingInstances && !inst.instances?.length) {
    return (
      <AppShell>
        <NoInstancesPrompt onAdd={() => router.push("/settings")} />
      </AppShell>
    );
  }

  const closeDrawer = () => drawer.setSelectedId(null);

  return (
    <AppShell>
      <PageErrorBoundary>
        <div className="flex flex-col gap-4">
          <MediaPageHeader
            title={t("title")}
            total={data.total}
            selected={selection.selected.size}
            activeInstance={inst.activeInstance}
            activeInstanceName={inst.typedInstances.find((i) => i.id === inst.activeInstance)?.name ?? null}
            typedInstances={inst.typedInstances}
            onSetInstance={inst.setInstanceId}
            onRefresh={() => refreshMutation.mutate(inst.activeInstance)}
            refreshPending={refreshMutation.isPending}
            isLoading={data.isLoading}
            isFetching={data.isFetching}
          />

          <MediaSearchBar
            arrType={arrType}
            instanceId={inst.activeInstance}
            scoringMode={scoringMode}
            filters={filters.filters}
            onChange={(next) => filters.setFilters((prev) => ({ ...prev, ...next }))}
          />

          <ActiveFilterChips chips={chips} />

          <BulkActionToolbar
            selectedCount={selection.selected.size}
            progress={bulkProgress}
            onCancel={abort.cancel}
            onSearch={handlers.handleSearch}
            onDelete={async (search) => {
              const items = selection.deletableSelected;
              if (!items.length) return;
              const ok = await askConfirm({
                title: tConfirmDeleteBulk("title"),
                body: tConfirmDeleteBulk("body", { count: items.length }),
                destructive: true,
              });
              if (ok) handlers.handleDelete(search);
            }}
            onIgnore={handlers.handleIgnore}
          />

          {(data.isLoading || inst.loadingInstances) && <MediaTableSkeleton />}
          {data.isError && <MediaErrorCard onRetry={data.refetch} />}
          {!inst.loadingInstances && !data.isLoading && !data.isError && data.items.length === 0 && (
            <MediaPageEmptyState
              hasInstance={inst.activeInstance > 0}
              noCfsConfigured={noCfsConfigured}
              hasActiveFilters={chips.length > 0}
              onClear={clearActiveFilters}
            />
          )}

          {!data.isLoading && data.items.length > 0 && (
            <div className={data.isFetching ? "opacity-50 pointer-events-none transition-opacity" : "transition-opacity"}>
              <MediaTable
                rows={data.items}
                columns={columns(ctx)}
                selectedIds={selection.selected}
                onToggleSelect={selection.toggle}
                onRowClick={drawer.setSelectedId}
                sortBy={filters.filters.sortBy}
                order={filters.filters.order}
                onSortChange={(key) =>
                  filters.setFilters((f) => ({
                    ...f,
                    sortBy: key,
                    order: f.sortBy === key && f.order === "asc" ? "desc" : "asc",
                  }))
                }
                rowActions={(item) => (
                  <RowHoverActions
                    onSearch={() => ctx.runSearch(item)}
                    onIgnore={async () => { await ctx.runIgnore(item); }}
                  />
                )}
                renderCard={(item) => renderCard(item, ctx)}
              />
            </div>
          )}

          <div ref={sentinelRef} className="h-4" />
          {data.isFetchingNextPage && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>

        {renderDrawer(drawer.selectedItem, ctx, closeDrawer)}
        {confirmDialog}
      </PageErrorBoundary>
    </AppShell>
  );
}
