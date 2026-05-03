"use client";
import { useQueries } from "@tanstack/react-query";
import { api } from "@/client/lib/api";
import { queryKeys } from "@/client/lib/query-keys";
import type { FlaggedSeries, ScoringMode } from "@/shared/types/models";
import type { PaginatedResponse } from "@/shared/types/api";

export type FlaggedSeriesWithInstance = FlaggedSeries & { __instanceId: number };

interface SeriesFilters {
  sortBy?: "score" | "title" | "added" | "size";
  order?: "asc" | "desc";
  maxScore?: number;
  q?: string;
  profileId?: number | null;
  missingCfId?: number | null;
  hasNegativeCfId?: number | null;
  scoringMode?: ScoringMode;
}

// See useMoviesAll for the bounded-per-instance rationale.
const PER_INSTANCE_LIMIT = 200;

function buildParams(instanceId: number, filters: SeriesFilters): string {
  const params = new URLSearchParams({
    instanceId: String(instanceId),
    limit: String(PER_INSTANCE_LIMIT),
    page: "1",
    ...Object.fromEntries(
      Object.entries(filters)
        .filter(([, v]) => v !== undefined && v !== null && v !== "")
        .map(([k, v]) => [k, String(v)]),
    ),
  });
  return params.toString();
}

interface InstancePage {
  items: FlaggedSeries[];
  hasMore: boolean;
  total: number;
}

async function fetchInstancePage(
  instanceId: number,
  filters: SeriesFilters,
): Promise<InstancePage> {
  const res = await api.get<PaginatedResponse<FlaggedSeries>>(
    `/sonarr/series?${buildParams(instanceId, filters)}`,
  );
  return { items: res.items, hasMore: res.hasMore, total: res.total };
}

export function useSeriesAll(instanceIds: number[], filters: SeriesFilters = {}) {
  const queries = useQueries({
    queries: instanceIds.map((id) => ({
      queryKey: queryKeys.series(id, { ...filters, mode: "all", limit: PER_INSTANCE_LIMIT }),
      queryFn: () => fetchInstancePage(id, filters),
      enabled: id > 0,
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    })),
  });

  const allSeries: FlaggedSeriesWithInstance[] = queries.flatMap((q, i) =>
    (q.data?.items ?? []).map((s) => ({ ...s, __instanceId: instanceIds[i] })),
  );
  const totalAcrossInstances = queries.reduce((acc, q) => acc + (q.data?.total ?? 0), 0);
  const truncated = queries.some((q) => q.data?.hasMore === true);
  const isLoading = queries.length > 0 && queries.some((q) => q.isLoading);
  const isError = queries.some((q) => q.isError);
  const isFetching = queries.some((q) => q.isFetching);
  const refetch = async () => {
    await Promise.all(queries.map((q) => q.refetch()));
  };

  return {
    allSeries,
    total: totalAcrossInstances,
    truncated,
    perInstanceLimit: PER_INSTANCE_LIMIT,
    isLoading,
    isError,
    isFetching,
    refetch,
  };
}
