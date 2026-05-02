import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
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
  const tSearch = useTranslations("toast.search");
  const tDelete = useTranslations("toast.delete");
  const tIgnore = useTranslations("toast.ignore");
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

  // Reset mode-specific filters when the user toggles scoring mode. Adjust
  // state during render — React aborts and restarts so there's no commit
  // between, no flash, and no setState-in-effect cascade.
  const [trackedMode, setTrackedMode] = useState(scoringMode);
  if (trackedMode !== scoringMode) {
    setTrackedMode(scoringMode);
    setFilters((f) => ({ ...f, missingCfId: null, hasNegativeCfId: null, maxScore: 1 }));
  }

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isFetching, isError, refetch } =
    useSeries(activeInstance, { ...filters, maxScore: debouncedMaxScore, q: debouncedQ, scoringMode });

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
        toast.info(tSearch("queuedDryRun"));
      } else {
        toast.success(tSearch("started"));
      }
    },
    onError: () => toast.error(tSearch("failed")),
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
        toast.info(search ? tDelete("queuedAndSearchDryRun") : tDelete("queuedDryRun"));
      } else {
        toast.success(search ? tDelete("filesDoneAndSearch") : tDelete("filesDone"));
        void refetch();
      }
    },
    onError: () => toast.error(tDelete("filesFailed")),
  });

  const runSearch = (series: FlaggedSeries[]) => searchMutation.mutateAsync(series);
  const runIgnore = withToast(ignoreMutation, { success: tIgnore("done"), error: tIgnore("failed") });
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
      if (r.isDryRun) toast.info(tSearch("seasonQueuedDryRun"));
      else toast.success(tSearch("seasonStarted"));
    },
    onError: () => toast.error(tSearch("seasonFailed")),
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
      if (r.isDryRun) toast.info(tSearch("episodeQueuedDryRun"));
      else toast.success(tSearch("episodeStarted"));
    },
    onError: (e: Error) => toast.error(e.message || tSearch("episodeFailed")),
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
      if (r.isDryRun) toast.info(vars.search ? tDelete("queuedAndSearchDryRun") : tDelete("queuedDryRun"));
      else { toast.success(vars.search ? tDelete("seasonDoneAndSearch") : tDelete("seasonDone")); void refetch(); }
    },
    onError: () => toast.error(tDelete("seasonFailed")),
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
      if (r.isDryRun) toast.info(vars.search ? tDelete("queuedAndSearchDryRun") : tDelete("queuedDryRun"));
      else { toast.success(vars.search ? tDelete("fileDoneAndSearch") : tDelete("fileDone")); void refetch(); }
    },
    onError: () => toast.error(tDelete("fileFailed")),
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

  const deletableSelected = () =>
    allSeries.filter((s) => selected.has(s.id) && s.episodeFiles.length > 0);

  const handleDelete = async (search: boolean) => {
    const toDelete = deletableSelected();
    if (!toDelete.length) return;
    await runDelete(toDelete, search);
    setSelected(new Set());
  };

  const deletableCount = () => deletableSelected().length;

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
    isFetching,
    isFetchingNextPage,
    refetch,
    sentinelRef,
    scoringMode,
    noCfsConfigured,
    handleSearch,
    handleIgnore,
    handleDelete,
    deletableCount,
    runSearch,
    runIgnore,
    runDelete,
    runSearchSeason,
    runSearchEpisode,
    runDeleteSeason,
    runDeleteEpisode,
  };
}
