import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  const searchParams = useSearchParams();
  const { data: instances, isLoading: loadingInstances } = useInstances();
  const [instanceId, setInstanceId] = useState<number>(() => {
    const fromUrl = Number(searchParams.get("instanceId") ?? "0");
    return Number.isFinite(fromUrl) && fromUrl > 0 ? fromUrl : 0;
  });
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [filters, setFilters] = useState<MediaFilters>({
    sortBy: "score",
    order: "asc",
    maxScore: 1,
    q: "",
    profileId: null,
    missingCfId: null,
    hasNegativeCfId: null,
  });
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const activeInstance = instanceId || instances?.find((i) => i.type === "sonarr")?.id || 0;
  const debouncedMaxScore = useDebouncedValue(filters.maxScore, 400);
  const debouncedQ = useDebouncedValue(filters.q, 300);

  const { data: config } = useConfig();
  const { data: prefs } = usePreferences(activeInstance);

  const scoringMode = (config?.scoringModes[`scoringMode:${activeInstance}`] ?? "manual") as ScoringMode;
  const noCfsConfigured = scoringMode === "manual" && (prefs?.length ?? 0) === 0;

  const [isModeTransitioning, setIsModeTransitioning] = useState(false);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isFetching, isError, refetch } =
    useSeries(activeInstance, { ...filters, maxScore: debouncedMaxScore, q: debouncedQ, scoringMode });

  useEffect(() => {
    setIsModeTransitioning(true);
    setFilters((f) => ({ ...f, missingCfId: null, hasNegativeCfId: null, maxScore: 1 }));
  }, [scoringMode]);

  useEffect(() => {
    if (!isFetching) setIsModeTransitioning(false);
  }, [isFetching]);

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

  const seasonSearchMutation = useMutation({
    mutationFn: async ({ series, seasonNumber }: { series: FlaggedSeries; seasonNumber: number }) => {
      return api.post<ActionLog>(`/sonarr/series/season-search`, {
        instanceId: activeInstance,
        mediaId: series.id,
        seasonNumber,
        title: `${series.title} — Season ${seasonNumber}`,
      });
    },
    onSuccess: (r) => {
      if (r.isDryRun) toast.info("[Dry Run] Season search queued");
      else toast.success("Season search triggered");
    },
    onError: () => toast.error("Failed to trigger season search"),
  });

  const episodeSearchMutation = useMutation({
    mutationFn: async ({ series, fileId, label }: { series: FlaggedSeries; fileId: number; label: string }) => {
      return api.post<ActionLog>(`/sonarr/series/episode-search`, {
        instanceId: activeInstance,
        mediaId: series.id,
        fileId,
        title: `${series.title} — ${label}`,
      });
    },
    onSuccess: (r) => {
      if (r.isDryRun) toast.info("[Dry Run] Episode search queued");
      else toast.success("Episode search triggered");
    },
    onError: (e: Error) => toast.error(e.message || "Failed to trigger episode search"),
  });

  const seasonDeleteMutation = useMutation({
    mutationFn: async ({ series, seasonNumber, fileIds, search }: {
      series: FlaggedSeries; seasonNumber: number; fileIds: number[]; search: boolean;
    }) => {
      return api.post<ActionLog>(`/sonarr/series/delete`, {
        instanceId: activeInstance,
        mediaId: series.id,
        fileIds,
        title: `${series.title} — Season ${seasonNumber}`,
        search,
      });
    },
    onSuccess: (r, vars) => {
      if (r.isDryRun) toast.info(vars.search ? "[Dry Run] Season delete & search queued" : "[Dry Run] Season delete queued");
      else { toast.success(vars.search ? "Season files deleted, search triggered" : "Season files deleted"); void refetch(); }
    },
    onError: () => toast.error("Failed to delete season files"),
  });

  const episodeDeleteMutation = useMutation({
    mutationFn: async ({ series, fileId, label, search }: {
      series: FlaggedSeries; fileId: number; label: string; search: boolean;
    }) => {
      return api.post<ActionLog>(`/sonarr/series/delete`, {
        instanceId: activeInstance,
        mediaId: series.id,
        fileIds: [fileId],
        title: `${series.title} — ${label}`,
        search,
      });
    },
    onSuccess: (r, vars) => {
      if (r.isDryRun) toast.info(vars.search ? "[Dry Run] Delete & search queued" : "[Dry Run] Delete queued");
      else { toast.success(vars.search ? "File deleted, search triggered" : "File deleted"); void refetch(); }
    },
    onError: () => toast.error("Failed to delete file"),
  });

  const runSearchSeason = (series: FlaggedSeries, seasonNumber: number) =>
    seasonSearchMutation.mutateAsync({ series, seasonNumber });
  const runSearchEpisode = (series: FlaggedSeries, fileId: number, label: string) =>
    episodeSearchMutation.mutateAsync({ series, fileId, label });
  const runDeleteSeason = (series: FlaggedSeries, seasonNumber: number, fileIds: number[], search: boolean) =>
    seasonDeleteMutation.mutateAsync({ series, seasonNumber, fileIds, search });
  const runDeleteEpisode = (series: FlaggedSeries, fileId: number, label: string, search: boolean) =>
    episodeDeleteMutation.mutateAsync({ series, fileId, label, search });

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
    isLoading: isLoading || isModeTransitioning,
    isError,
    isFetching,
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
    runSearchSeason,
    runSearchEpisode,
    runDeleteSeason,
    runDeleteEpisode,
  };
}
