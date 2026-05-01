import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useInstances } from "./useInstances";
import { useSeries } from "./useSeries";
import { useConfig } from "./useConfig";
import { usePreferences } from "./usePreferences";
import { useDebouncedValue } from "./useDebouncedValue";
import { useInfiniteScroll } from "./useInfiniteScroll";
import { toast } from "sonner";
import { api } from "@/client/lib/api";
import { withToast } from "@/client/lib/with-toast";
import type { ActionLog, FlaggedSeries, ScoringMode } from "@/shared/types/models";
import type { MediaFilters } from "./useMoviesPage";

export function useShowsPage() {
  const router = useRouter();
  const { data: instances, isLoading: loadingInstances } = useInstances();
  const [instanceId, setInstanceId] = useState<number>(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [filters, setFilters] = useState<MediaFilters>({
    sortBy: "score",
    order: "asc",
    maxScore: 1,
    q: "",
    profileId: null,
    missingCfId: null,
  });
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const activeInstance = instanceId || instances?.find((i) => i.type === "sonarr")?.id || 0;
  const debouncedMaxScore = useDebouncedValue(filters.maxScore, 400);
  const debouncedQ = useDebouncedValue(filters.q, 300);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError, refetch } =
    useSeries(activeInstance, { ...filters, maxScore: debouncedMaxScore, q: debouncedQ });
  const { data: config } = useConfig();
  const { data: prefs } = usePreferences(activeInstance);

  const scoringMode = (config?.scoringModes[`scoringMode:${activeInstance}`] ?? "manual") as ScoringMode;
  const noCfsConfigured = scoringMode === "manual" && (prefs?.length ?? 0) === 0;

  const sentinelRef = useInfiniteScroll(fetchNextPage, !!hasNextPage);
  const allSeries: FlaggedSeries[] = data?.pages.flatMap((p) => p.items) ?? [];
  const total = data?.pages[0]?.total ?? 0;
  const sonarrInstances = instances?.filter((i) => i.type === "sonarr") ?? [];

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const searchMutation = useMutation({
    mutationFn: async (series: FlaggedSeries[]) => {
      const results: ActionLog[] = [];
      for (const s of series) {
        const r = await api.post<ActionLog>(`/sonarr/series/search`, { instanceId: activeInstance, mediaId: s.id, title: s.title });
        results.push(r);
      }
      return results;
    },
    onSuccess: (results) => {
      if (results.some((r) => r.isDryRun)) {
        toast.info("[Dry Run] Search queued");
      } else {
        toast.success("Search triggered");
      }
    },
    onError: () => toast.error("Failed to trigger search"),
  });

  const ignoreMutation = useMutation({
    mutationFn: async (series: FlaggedSeries[]) => {
      for (const s of series) {
        await api.post(`/ignore`, { instanceId: activeInstance, mediaId: s.id, mediaType: "series", title: s.title });
      }
    },
    onSuccess: () => refetch(),
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ series, search }: { series: FlaggedSeries[]; search: boolean }) => {
      const results: ActionLog[] = [];
      for (const s of series.filter((s) => s.episodeFiles.length > 0)) {
        const r = await api.post<ActionLog>(`/sonarr/series/delete`, {
          instanceId: activeInstance,
          mediaId: s.id,
          fileIds: s.episodeFiles.map((f) => f.id),
          title: s.title,
          search,
        });
        results.push(r);
      }
      return { results, search };
    },
    onSuccess: ({ results, search }) => {
      if (results.some((r) => r.isDryRun)) {
        toast.info(search ? "[Dry Run] Delete & search queued" : "[Dry Run] Delete queued");
      } else {
        toast.success(search ? "Files deleted, search triggered" : "Files deleted");
        void refetch();
      }
    },
    onError: () => toast.error("Failed to delete files"),
  });

  const runSearch = (series: FlaggedSeries[]) => searchMutation.mutateAsync(series);
  const runIgnore = withToast(ignoreMutation, { success: "Items ignored", error: "Failed to ignore items" });
  const runDelete = (series: FlaggedSeries[], search: boolean) => deleteMutation.mutateAsync({ series, search });

  const handleSearch = async () => {
    await runSearch(allSeries.filter((s) => selected.has(s.id)));
    setSelected(new Set());
  };

  const handleIgnore = async () => {
    await runIgnore(allSeries.filter((s) => selected.has(s.id)));
    setSelected(new Set());
  };

  const handleDelete = async (search: boolean) => {
    const toDelete = allSeries.filter((s) => selected.has(s.id) && s.episodeFiles.length > 0);
    if (!toDelete.length) return;
    if (!confirm(`Delete all files for ${toDelete.length} series? This cannot be undone.`)) return;
    await runDelete(toDelete, search);
    setSelected(new Set());
  };

  const selectedItem = allSeries.find((s) => s.id === selectedId) ?? null;

  return {
    router,
    instances,
    loadingInstances,
    sonarrInstances,
    activeInstance,
    setInstanceId,
    selected,
    toggle,
    filters,
    setFilters,
    selectedId,
    setSelectedId,
    selectedItem,
    allSeries,
    total,
    isLoading,
    isError,
    isFetchingNextPage,
    refetch,
    sentinelRef,
    scoringMode,
    noCfsConfigured,
    handleSearch,
    handleIgnore,
    handleDelete,
    runSearch,
    runIgnore,
    runDelete,
  };
}
