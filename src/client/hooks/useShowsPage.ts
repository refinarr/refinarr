import { useState } from "react";
import { useRouter } from "next/navigation";
import { useInstances } from "./useInstances";
import { useSeries } from "./useSeries";
import { useConfig } from "./useConfig";
import { usePreferences } from "./usePreferences";
import { useDebouncedValue } from "./useDebouncedValue";
import { useInfiniteScroll } from "./useInfiniteScroll";
import { api } from "@/client/lib/api";
import { toast } from "sonner";
import type { FlaggedSeries, ScoringMode } from "@/shared/types/models";
import type { MediaFilters } from "./useMoviesPage";

export function useShowsPage() {
  const router = useRouter();
  const { data: instances, isLoading: loadingInstances } = useInstances();
  const [instanceId, setInstanceId] = useState<number>(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [filters, setFilters] = useState<MediaFilters>({ sortBy: "score", order: "asc", maxScore: 1 });

  const activeInstance = instanceId || instances?.find((i) => i.type === "sonarr")?.id || 0;
  const debouncedMaxScore = useDebouncedValue(filters.maxScore, 400);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError, refetch } =
    useSeries(activeInstance, { ...filters, maxScore: debouncedMaxScore });
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
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSearch = async () => {
    const selectedSeries = allSeries.filter((s) => selected.has(s.id));
    for (const s of selectedSeries) {
      await api.post(`/sonarr/series/search`, { instanceId: activeInstance, mediaId: s.id, title: s.title });
    }
    toast.success("Search triggered");
    setSelected(new Set());
  };

  const handleIgnore = async () => {
    const selectedSeries = allSeries.filter((s) => selected.has(s.id));
    for (const s of selectedSeries) {
      await api.post(`/ignore`, { instanceId: activeInstance, mediaId: s.id, mediaType: "series", title: s.title });
    }
    toast.success("Items ignored");
    setSelected(new Set());
    refetch();
  };

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
  };
}
