"use client";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { AppShell } from "@/client/components/layout/AppShell";
import {
  BulkActionToolbar,
  type BulkProgress,
} from "@/client/components/media/BulkActionToolbar";
import { MediaTableSkeleton } from "@/client/components/media/MediaTableSkeleton";
import { MediaPageHeader } from "@/client/components/media/MediaPageHeader";
import { MediaSearchBar } from "@/client/components/media/MediaSearchBar";
import { MobileFilterBar } from "@/client/components/media/MobileFilterBar";
import {
  MediaTable,
  type ColumnDef,
} from "@/client/components/media/MediaTable";
import { ActiveFilterChips } from "@/client/components/common/ActiveFilterChips";
import { RowHoverActions } from "@/client/components/common/RowHoverActions";
import { NoInstancesPrompt } from "@/client/components/states/NoInstancesPrompt";
import { MediaErrorCard } from "@/client/components/states/MediaErrorCard";
import {
  MediaPageEmptyState,
  type EmptyStateKind,
} from "@/client/components/states/MediaPageEmptyState";
import { PageErrorBoundary } from "@/client/components/states/PageErrorBoundary";
import { usePreferences } from "@/client/hooks/data/usePreferences";
import { useQualityProfiles } from "@/client/hooks/data/useQualityProfiles";
import { useRefreshInstance } from "@/client/hooks/data/useRefreshInstance";
import { useQueuedMediaIds } from "@/client/hooks/data/useSearchQueue";
import { useRecentSearchMap } from "@/client/hooks/data/useRecentSearches";
import { withToast } from "@/client/lib/with-toast";
import { useConfirm } from "@/client/hooks/ui/useConfirm";
import { useDensity, type Density } from "@/client/hooks/ui/useDensity";
import { useInfiniteScroll } from "@/client/hooks/ui/useInfiniteScroll";
import { useInstanceSelection } from "@/client/hooks/media/useInstanceSelection";
import {
  useMediaFilters,
  type MediaFilters,
} from "@/client/hooks/media/useMediaFilters";
import { useFilterChips } from "@/client/hooks/media/useFilterChips";
import { useMediaSelection } from "@/client/hooks/media/useMediaSelection";
import { useDetailDrawer } from "@/client/hooks/media/useDetailDrawer";
import {
  useMediaData,
  type MediaDataQueryHook,
} from "@/client/hooks/media/useMediaData";
import { useBulkAbort } from "@/client/hooks/media/useBulkAbort";
import {
  useBulkMediaActions,
  type BulkActionsConfig,
} from "@/client/hooks/media/useBulkMediaActions";
import { useBulkHandlers } from "@/client/hooks/media/useBulkHandlers";
import { DEFAULT_SCORING_MODE, isManualMode } from "@/shared/scoring-mode";
import type {
  ArrType,
  MediaItem,
  QualityProfile,
  ScoringMode,
} from "@/shared/types/models";

type TFn = ReturnType<typeof useTranslations>;

// Render-time context handed to leaf components (Card, Drawer). Same shape
// the props-based shell exposed; promoted to React Context so compound
// sub-components don't need to receive ctx through props.
export interface MediaListShellRenderCtx<T extends MediaItem> {
  arrType: ArrType;
  scoringMode: ScoringMode;
  profiles: QualityProfile[] | undefined;
  activeInstance: number;
  queuedIds: Set<number>;
  recentMap: Map<number, Date>;
  // Active row density. Read by column defs (e.g. issues cell shows
  // 1 badge in compact, 2 in cozy) and by MediaTable for row height.
  density: Density;
  refetch: () => unknown;
  runSearch: (item: T) => Promise<unknown>;
  runIgnore: (item: T) => Promise<unknown>;
  runDelete: (item: T, triggerSearch: boolean) => Promise<unknown>;
  // Filter state + patch setter exposed so column defs can render
  // per-column funnel popovers (e.g. CfColumnFunnel) that mutate the
  // same filter slice MediaSearchBar reads from.
  filters: MediaFilters;
  onFilterChange: (patch: Partial<MediaFilters>) => void;
  // Pre-computed CF option lists — `missing` is the user's "wanted"
  // CFs (manual scoring), `penalty` is the negative-score formats from
  // active quality profiles (profile scoring). Same shape both ways
  // so column funnels stay scoring-mode-agnostic.
  cfOptions: {
    missing: { id: number; name: string }[];
    penalty: { id: number; name: string }[];
  };
  t: TFn;
  tCols: TFn;
  tTime: TFn;
}

// Internal context — exposes everything sub-components need. Typed against
// MediaItem base; consumers narrow via useShellContext<T>().
interface InternalShellContext {
  ctx: MediaListShellRenderCtx<MediaItem>;
  inst: ReturnType<typeof useInstanceSelection>;
  filters: ReturnType<typeof useMediaFilters>;
  data: ReturnType<typeof useMediaData<MediaItem>>;
  selection: ReturnType<typeof useMediaSelection<MediaItem>>;
  drawer: ReturnType<typeof useDetailDrawer<MediaItem>>;
  handlers: ReturnType<typeof useBulkHandlers<MediaItem>>;
  bulkProgress: BulkProgress | null;
  abort: ReturnType<typeof useBulkAbort>;
  refreshMutation: ReturnType<typeof useRefreshInstance>;
  chips: ReturnType<typeof useFilterChips>["chips"];
  clearActiveFilters: () => void;
  noCfsConfigured: boolean;
  askConfirm: ReturnType<typeof useConfirm>["confirm"];
  i18nNamespace: "movies" | "shows";
  confirmDeleteBulkKey: "confirm.deleteMovies" | "confirm.deleteSeries";
}

const ShellContext = createContext<InternalShellContext | null>(null);

function useShellContext<T extends MediaItem>(): Omit<
  InternalShellContext,
  "ctx"
> & {
  ctx: MediaListShellRenderCtx<T>;
  data: ReturnType<typeof useMediaData<T>>;
  selection: ReturnType<typeof useMediaSelection<T>>;
  drawer: ReturnType<typeof useDetailDrawer<T>>;
  handlers: ReturnType<typeof useBulkHandlers<T>>;
} {
  const value = useContext(ShellContext);
  if (!value)
    throw new Error(
      "MediaListShell sub-components must be rendered inside <MediaListShell>",
    );
  // Internal context erases T to MediaItem. Narrow via cast — caller
  // supplies the type parameter when the page knows what kind of media this is.
  return value as never;
}

// ─────────────────────────────────────────────────────────────────────────
// Root
// ─────────────────────────────────────────────────────────────────────────

const COLUMNS_NS: Record<
  "movies" | "shows",
  "movies.columns" | "shows.columns"
> = {
  movies: "movies.columns",
  shows: "shows.columns",
};

interface RootProps<T extends MediaItem> {
  arrType: ArrType;
  bulkConfig: Pick<
    BulkActionsConfig<T>,
    "mediaType" | "search" | "ignore" | "delete"
  >;
  useQuery: MediaDataQueryHook<T>;
  i18nNamespace: "movies" | "shows";
  confirmDeleteBulkKey: "confirm.deleteMovies" | "confirm.deleteSeries";
  children: ReactNode;
}

function Root<T extends MediaItem>({
  arrType,
  bulkConfig,
  useQuery,
  i18nNamespace,
  confirmDeleteBulkKey,
  children,
}: RootProps<T>) {
  const t = useTranslations(i18nNamespace);
  const tCols = useTranslations(COLUMNS_NS[i18nNamespace]);
  const tTime = useTranslations("time");
  const router = useRouter();

  const inst = useInstanceSelection(arrType);
  const { data: prefs } = usePreferences(inst.activeInstance);
  const { data: profiles } = useQualityProfiles(arrType, inst.activeInstance);
  const refreshMutation = useRefreshInstance();
  const { confirm: askConfirm, dialog: confirmDialog } = useConfirm();

  const activeInstanceRow = inst.typedInstances.find(
    (i) => i.id === inst.activeInstance,
  );
  const scoringMode: ScoringMode =
    activeInstanceRow?.scoringMode ?? DEFAULT_SCORING_MODE;
  const showAllEnabled = activeInstanceRow?.showAllMedia ?? false;
  const noCfsConfigured =
    isManualMode(scoringMode) && (prefs?.length ?? 0) === 0;

  const filters = useMediaFilters(
    scoringMode,
    inst.activeInstance,
    showAllEnabled,
  );
  const data = useMediaData<T>(useQuery, inst.activeInstance, filters.forQuery);
  const queuedIds = useQueuedMediaIds(inst.activeInstance);
  const recentMap = useRecentSearchMap(inst.activeInstance);
  const selection = useMediaSelection<T>(
    data.items,
    bulkConfig.delete.isDeletable,
  );
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
  const { chips, clearActiveFilters } = useFilterChips({
    filters,
    prefs,
    profiles,
  });

  const cfOptions = useMemo(() => {
    const missing = (prefs ?? []).map((p) => ({ id: p.cfId, name: p.cfName }));
    const penaltyPairs = (profiles ?? [])
      .flatMap((p) => p.formatItems ?? [])
      .filter((item) => item.score < 0)
      .map((item) => [item.format, item.name] as const);
    const penalty = Array.from(new Map(penaltyPairs), ([id, name]) => ({
      id,
      name,
    }));
    return { missing, penalty };
  }, [prefs, profiles]);

  const { density, toggle: toggleDensity } = useDensity();
  // `,` keyboard shortcut toggles density. Skips when typing in inputs
  // so search-bar text entry isn't hijacked.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key !== ",") return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) {
        return;
      }
      event.preventDefault();
      toggleDensity();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggleDensity]);
  const ctx: MediaListShellRenderCtx<T> = {
    arrType,
    scoringMode,
    profiles,
    activeInstance: inst.activeInstance,
    queuedIds,
    recentMap,
    density,
    refetch: data.refetch,
    runSearch: (item) =>
      actions.searchMutation.mutateAsync({ items: [item], isBulk: false }),
    runIgnore: (item) =>
      actions.ignoreWithToast({ items: [item], isBulk: false }),
    runDelete: (item, triggerSearch) =>
      actions.deleteMutation.mutateAsync({
        items: [item],
        isBulk: false,
        search: triggerSearch,
      }),
    filters: filters.filters,
    onFilterChange: (patch) =>
      filters.setFilters((prev) => ({ ...prev, ...patch })),
    cfOptions,
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

  // Cast to the MediaItem-erased shape the context exposes. Sub-components
  // re-narrow with their own T parameter via useShellContext<T>().
  const value: InternalShellContext = {
    ctx: ctx as MediaListShellRenderCtx<MediaItem>,
    inst,
    filters,
    data: data as ReturnType<typeof useMediaData<MediaItem>>,
    selection: selection as ReturnType<typeof useMediaSelection<MediaItem>>,
    drawer: drawer as ReturnType<typeof useDetailDrawer<MediaItem>>,
    handlers: handlers as ReturnType<typeof useBulkHandlers<MediaItem>>,
    bulkProgress,
    abort,
    refreshMutation,
    chips,
    clearActiveFilters,
    noCfsConfigured,
    askConfirm,
    i18nNamespace,
    confirmDeleteBulkKey,
  };

  return (
    <AppShell>
      <PageErrorBoundary>
        <ShellContext.Provider value={value}>
          {/*
            pb-mobile-filter-bar reserves vertical space below the last
            row so it isn't hidden behind the fixed MobileFilterBar.
            md:pb-0 zeroes the reservation on desktop where the
            MobileFilterBar is hidden.
          */}
          <div className="pb-mobile-filter-bar flex flex-col gap-4 md:pb-0">
            {children}
          </div>
          <MobileFilterBar
            scoringMode={ctx.scoringMode}
            profiles={profiles}
            cfOptions={cfOptions}
            filters={filters.filters}
            onChange={(patch) =>
              filters.setFilters((prev) => ({ ...prev, ...patch }))
            }
          />
          {confirmDialog}
        </ShellContext.Provider>
      </PageErrorBoundary>
    </AppShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Sub-components — each consumes ShellContext, no props (or minimal)
// ─────────────────────────────────────────────────────────────────────────

function Header() {
  const { ctx, inst, refreshMutation, data, selection } = useShellContext();
  const tRefresh = useTranslations("toast.refresh");
  const refreshWithToast = withToast(refreshMutation, {
    success: tRefresh("done"),
    error: tRefresh("failed"),
  });
  return (
    <MediaPageHeader
      title={ctx.t("title")}
      total={data.total}
      selected={selection.selected.size}
      activeInstance={inst.activeInstance}
      activeInstanceName={
        inst.typedInstances.find((i) => i.id === inst.activeInstance)?.name ??
        null
      }
      typedInstances={inst.typedInstances}
      onSetInstance={inst.setInstanceId}
      onRefresh={() => refreshWithToast(inst.activeInstance)}
      refreshPending={refreshMutation.isPending}
      isLoading={data.isLoading}
      isFetching={data.isFetching}
    />
  );
}

function SearchBar() {
  const { filters } = useShellContext();
  return (
    <MediaSearchBar
      filters={filters.filters}
      onChange={(next) => filters.setFilters((prev) => ({ ...prev, ...next }))}
    />
  );
}

function Chips() {
  const { chips } = useShellContext();
  return <ActiveFilterChips chips={chips} />;
}

function BulkBar() {
  const {
    selection,
    bulkProgress,
    abort,
    handlers,
    askConfirm,
    confirmDeleteBulkKey,
  } = useShellContext();
  const tConfirmDeleteBulk = useTranslations(confirmDeleteBulkKey);

  return (
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
  );
}

interface BodyProps<T extends MediaItem> {
  columns: (ctx: MediaListShellRenderCtx<T>) => ColumnDef<T>[];
  Card: ComponentType<{ item: T; ctx: MediaListShellRenderCtx<T> }>;
}

function Body<T extends MediaItem>({ columns, Card }: BodyProps<T>) {
  const {
    ctx,
    inst,
    data,
    selection,
    drawer,
    filters,
    chips,
    clearActiveFilters,
    noCfsConfigured,
  } = useShellContext<T>();
  const sentinelRef = useInfiniteScroll(data.fetchNextPage, data.hasNextPage);

  return (
    <>
      {(data.isLoading || inst.loadingInstances) && <MediaTableSkeleton />}
      {data.isError && <MediaErrorCard onRetry={data.refetch} />}
      {!inst.loadingInstances &&
        !data.isLoading &&
        !data.isError &&
        data.items.length === 0 &&
        (() => {
          let emptyState: EmptyStateKind;
          if (inst.activeInstance <= 0 || noCfsConfigured)
            emptyState = "no-cfs";
          else if (chips.length > 0) emptyState = "filtered-empty";
          else emptyState = "all-clear";
          return (
            <MediaPageEmptyState
              state={emptyState}
              onClear={clearActiveFilters}
            />
          );
        })()}

      {!data.isLoading && data.items.length > 0 && (
        <div
          className={
            data.isFetching
              ? "pointer-events-none opacity-50 transition-opacity"
              : "transition-opacity"
          }
        >
          <MediaTable
            rows={data.items}
            columns={columns(ctx)}
            density={ctx.density}
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
                onIgnore={async () => {
                  await ctx.runIgnore(item);
                }}
              />
            )}
            renderCard={(item) => <Card item={item} ctx={ctx} />}
          />
        </div>
      )}

      <div ref={sentinelRef} className="h-4" />
      {data.isFetchingNextPage && (
        <div className="flex justify-center py-4">
          <Loader2 className="text-muted-foreground size-5 animate-spin" />
        </div>
      )}
    </>
  );
}

interface DrawerProps<T extends MediaItem> {
  as: ComponentType<{
    item: T | null;
    ctx: MediaListShellRenderCtx<T>;
    close: () => void;
  }>;
}

function Drawer<T extends MediaItem>({ as: Component }: DrawerProps<T>) {
  const { ctx, drawer } = useShellContext<T>();
  return (
    <Component
      item={drawer.selectedItem}
      ctx={ctx}
      close={() => drawer.setSelectedId(null)}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Compound export
// ─────────────────────────────────────────────────────────────────────────

export const MediaListShell = Object.assign(Root, {
  Header,
  SearchBar,
  Chips,
  BulkBar,
  Body,
  Drawer,
});
