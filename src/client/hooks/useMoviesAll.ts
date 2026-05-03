"use client";
import { useQueries } from "@tanstack/react-query";
import { api } from "@/client/lib/api";
import { queryKeys } from "@/client/lib/query-keys";
import type { FlaggedMovie, ScoringMode } from "@/shared/types/models";
import type { PaginatedResponse } from "@/shared/types/api";

export type FlaggedMovieWithInstance = FlaggedMovie & { __instanceId: number };

interface MovieFilters {
  sortBy?: "score" | "title" | "added" | "size";
  order?: "asc" | "desc";
  maxScore?: number;
  q?: string;
  profileId?: number | null;
  missingCfId?: number | null;
  hasNegativeCfId?: number | null;
  scoringMode?: ScoringMode;
}

// Bounded per-instance page size for "All" mode. The single-instance hook
// uses infinite scroll at 50/page; "All" mode pulls one larger page per
// instance and surfaces a `truncated` flag if any instance has more results.
// This avoids the pathological case where one instance has thousands of
// flagged items — a "fetch all pages" walk would issue dozens of upstream
// requests just to render a list nobody can scan. Users with that many
// results are expected to narrow filters.
const PER_INSTANCE_LIMIT = 200;

function buildParams(instanceId: number, filters: MovieFilters): string {
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
  items: FlaggedMovie[];
  hasMore: boolean;
  total: number;
}

async function fetchInstancePage(
  instanceId: number,
  filters: MovieFilters,
): Promise<InstancePage> {
  const res = await api.get<PaginatedResponse<FlaggedMovie>>(
    `/radarr/movies?${buildParams(instanceId, filters)}`,
  );
  return { items: res.items, hasMore: res.hasMore, total: res.total };
}

export function useMoviesAll(instanceIds: number[], filters: MovieFilters = {}) {
  const queries = useQueries({
    queries: instanceIds.map((id) => ({
      queryKey: queryKeys.movies(id, { ...filters, mode: "all", limit: PER_INSTANCE_LIMIT }),
      queryFn: () => fetchInstancePage(id, filters),
      enabled: id > 0,
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    })),
  });

  const allMovies: FlaggedMovieWithInstance[] = queries.flatMap((q, i) =>
    (q.data?.items ?? []).map((m) => ({ ...m, __instanceId: instanceIds[i] })),
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
    allMovies,
    total: totalAcrossInstances,
    truncated,
    perInstanceLimit: PER_INSTANCE_LIMIT,
    isLoading,
    isError,
    isFetching,
    refetch,
  };
}
