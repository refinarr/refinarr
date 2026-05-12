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
import { RefreshCw } from "lucide-react";
import { cn } from "@/client/lib/utils";
import { AppShell } from "@/client/components/layout/AppShell";
import { Button } from "@/client/components/ui/button";
import {
  BulkActionToolbar,
  type BulkProgress,
} from "@/client/components/media/BulkActionToolbar";
import { DensityToggle } from "@/client/components/media/DensityToggle";
import { InstancePicker } from "@/client/components/media/InstancePicker";
import { MediaTableSkeleton } from "@/client/components/media/MediaTableSkeleton";
import { MediaSearchBar } from "@/client/components/media/MediaSearchBar";
import { MobileFilterBar } from "@/client/components/media/MobileFilterBar";
import { ScoringModeSelector } from "@/client/components/settings/ScoringModeSelector";
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
  // a11y.table translator — column defs use this for non-visible
  // aria-labels (overflow trigger, resize handle, etc.). Centralized in
  // ctx so per-page column factories don't each call useTranslations.
  tA11y: TFn;
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
  const tA11y = useTranslations("a11y.table");
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

  const { density, cycle: cycleDensity } = useDensity();
  // `,` keyboard shortcut cycles density — matches the top-bar density
  // button (cozy → compact → card → cozy). Previously used the legacy
  // toggle() which only flipped compact ↔ cozy, so the shortcut could
  // never reach "card" and would kick the user OUT of card unexpectedly.
  // Skips when typing in inputs so search-bar text entry isn't hijacked.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      // Bare `,` only — Cmd+, / Ctrl+, is the OS "Preferences" shortcut
      // and Alt+, is reserved on some platforms.
      if (event.key !== "," || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) {
        return;
      }
      event.preventDefault();
      cycleDensity();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [cycleDensity]);
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
    tA11y,
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
    // ShellContext wraps AppShell so the topHeaderSlot — rendered
    // inside AppShell's TopHeader — can call useShellContext(). Putting
    // the provider on the inside (under AppShell's children) would
    // leave the slot out of scope and crash with "must be inside <Shell>".
    <ShellContext.Provider value={value}>
      {/*
        scrollMode="viewport" lets the table wrapper own the scrollbar
        in BOTH axes — required so the sticky table header pins to a
        stable viewport position when the user resizes a column wider
        than the viewport (horizontal scroll lives inside the wrapper)
        AND the user scrolls a long list (vertical scroll also inside
        the wrapper). main becomes a non-scrolling flex column.
      */}
      <AppShell
        scrollMode="viewport"
        topHeaderSlot={<MediaListShellTopBar />}
        topHeaderBelowSlot={<MediaListShellBulkBar />}
      >
        <PageErrorBoundary>
          {/*
            Flex-col fills main's available height. Chips take their
            natural row; Body's table wrapper takes flex-1 and scrolls.
            No flex gap between them on purpose: the Chips wrapper
            carries its own vertical padding (py-2 md:py-3) and the
            table's `border-y` top edge handles the visual separator,
            so the chip strip reads as the table's filter row rather
            than a floating section above it (Linear / Stripe / GitHub
            pattern). No reserved bottom padding either — the mobile
            chrome (TabBar, FilterBar, BulkActionToolbar) is fixed +
            translucent and auto-hides on scroll-down, so reserving
            space would leave an empty band below the last row.
          */}
          <div className="flex min-h-0 flex-1 flex-col">{children}</div>
          <MobileFilterBar
            scoringMode={ctx.scoringMode}
            profiles={profiles}
            cfOptions={cfOptions}
            filters={filters.filters}
            onChange={(patch) =>
              filters.setFilters((prev) => ({ ...prev, ...patch }))
            }
          />
          {/*
            Mobile bulk action bar — the desktop instance lives in
            MediaListShellTopBar (inside AppShell's topHeaderSlot, which
            is `hidden md:flex`). On mobile the slot is invisible, so we
            render a second instance here gated `md:hidden`.
            BulkActionToolbar already has a fixed-bottom mobile visual;
            wiring this second mount makes it reachable. Returns null
            when nothing is selected, so it's free when idle.
          */}
          <div className="md:hidden">
            <MediaListShellBulkBar />
          </div>
          {confirmDialog}
        </PageErrorBoundary>
      </AppShell>
    </ShellContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────────
// MediaListShellBulkBar — extracts the BulkActionToolbar bindings so
// the component can be rendered in TWO places:
//   • Inside the top bar slot (desktop visual — `hidden md:flex`).
//   • Inside the Root, gated `md:hidden` (mobile fixed-bottom visual).
// BulkActionToolbar already branches between these visuals internally;
// it just needs to be reachable from mobile, which it wasn't when the
// only render lived inside the desktop-only slot.
// ─────────────────────────────────────────────────────────────────────

function MediaListShellBulkBar() {
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
      onIgnore={handlers.handleIgnore}
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
    />
  );
}

// ─────────────────────────────────────────────────────────────────────
// MediaListShellTopBar — private. Composes the per-page chrome that
// fills AppShell's TopHeader slot on movies/shows pages: instance
// picker (with count subtitle), scoring mode, density, refresh, bulk
// actions (animated), and search. qui-style: a single horizontal bar
// whose content changes by selection state but whose height stays
// constant, so (de)selecting never shifts the table below.
// ─────────────────────────────────────────────────────────────────────

function MediaListShellTopBar() {
  const { inst, data, refreshMutation, filters } = useShellContext();
  const tRefresh = useTranslations("toast.refresh");
  const tCommon = useTranslations("common");
  const tInstSel = useTranslations("instanceSelector");

  const refreshWithToast = withToast(refreshMutation, {
    success: tRefresh("done"),
    error: tRefresh("failed"),
  });

  const subtitle = tInstSel("flaggedSummaryShort", {
    total: data.total,
  });
  const showInstanceContext =
    inst.activeInstance > 0 &&
    !!inst.typedInstances.find((i) => i.id === inst.activeInstance)?.name;

  return (
    <>
      <InstancePicker
        instances={inst.typedInstances}
        activeId={inst.activeInstance}
        onChange={inst.setInstanceId}
        subtitle={subtitle}
      />
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => refreshWithToast(inst.activeInstance)}
        disabled={refreshMutation.isPending}
        title={tCommon("refresh")}
        aria-label={tCommon("refresh")}
      >
        <RefreshCw
          className={cn("size-4", refreshMutation.isPending && "animate-spin")}
        />
      </Button>

      {showInstanceContext && (
        <ScoringModeSelector instanceId={inst.activeInstance} hideLabel />
      )}

      {/*
        Search + density grouped at the right edge via `ml-auto`.
        The search wrapper caps at 224px (`max-w-56`) but shrinks via
        `min-w-0 flex-1` when the slot is narrow, so the row stays
        single-line instead of wrapping. The TopHeader slot is
        `flex-nowrap min-w-0`, which lets this shrink propagate.
      */}
      <div className="ml-auto flex min-w-0 items-center gap-2">
        <div className="max-w-56 min-w-0 flex-1">
          <MediaSearchBar
            filters={filters.filters}
            onChange={(next) =>
              filters.setFilters((prev) => ({ ...prev, ...next }))
            }
          />
        </div>
        <DensityToggle />
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Sub-components — each consumes ShellContext, no props (or minimal)
// ─────────────────────────────────────────────────────────────────────────

function Chips() {
  const { chips, clearActiveFilters } = useShellContext();
  // Chips sit ABOVE the scrollable table wrapper. Horizontal padding
  // matches the rest of the page (px-4 md:px-6). Vertical padding is
  // intentionally tighter (py-2 md:py-3) so the strip reads as a slim
  // band rather than a full section — `items-center` keeps the row
  // centered inside it.
  return (
    <div className="flex shrink-0 items-center px-4 py-2 md:px-6 md:py-3">
      <ActiveFilterChips chips={chips} onClearAll={clearActiveFilters} />
    </div>
  );
}

interface BodyProps<T extends MediaItem> {
  columns: (ctx: MediaListShellRenderCtx<T>) => ColumnDef<T>[];
  Card: ComponentType<{ item: T; ctx: MediaListShellRenderCtx<T> }>;
  // Key used to persist column widths in localStorage per page
  // (`"movies"`, `"shows"`). Required so movies + shows don't share a
  // sizing namespace.
  tableId: string;
}

function Body<T extends MediaItem>({ columns, Card, tableId }: BodyProps<T>) {
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

  const hasItems = !data.isLoading && data.items.length > 0;

  return (
    // Body owns the flex-1 region inside main's flex-col. min-h-0 lets
    // the table wrapper actually shrink to fit (without it, flex
    // children with intrinsic content min-content prevent overflow
    // from kicking in).
    <div className="flex min-h-0 flex-1 flex-col">
      {(data.isLoading || inst.loadingInstances) && (
        <div className="px-4 md:px-6">
          <MediaTableSkeleton />
        </div>
      )}
      {data.isError && (
        <div className="px-4 md:px-6">
          <MediaErrorCard onRetry={data.refetch} />
        </div>
      )}
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
            <div className="px-4 md:px-6">
              <MediaPageEmptyState
                state={emptyState}
                onClear={clearActiveFilters}
              />
            </div>
          );
        })()}

      {hasItems && (
        <div
          className={cn(
            "flex min-h-0 flex-1 flex-col transition-opacity",
            data.isFetching && "pointer-events-none opacity-50",
          )}
        >
          <MediaTable
            tableId={tableId}
            rows={data.items}
            columns={columns(ctx)}
            density={ctx.density}
            fetchNextPage={data.fetchNextPage}
            hasNextPage={data.hasNextPage}
            isFetchingNextPage={data.isFetchingNextPage}
            selectedIds={selection.selected}
            onToggleSelect={selection.toggle}
            allSelected={selection.allSelected}
            someSelected={selection.someSelected}
            onToggleAll={selection.toggleAll}
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
    </div>
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
  Chips,
  Body,
  Drawer,
});
