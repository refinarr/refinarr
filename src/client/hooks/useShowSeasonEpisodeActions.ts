import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { api } from "@/client/lib/api";
import type { ActionLog, FlaggedSeries } from "@/shared/types/models";

export interface SeasonEpisodeConfig {
  fallbackInstance: number;
  refetch: () => unknown;
}

// Series-only single-item actions that don't fan out across instances.
// Carries __instanceId from the series argument when present (so a row in
// "All Sonarr" mode dispatches to the right instance), otherwise falls back
// to the page's active instance. Toast strings are resolved here.
export function useShowSeasonEpisodeActions(config: SeasonEpisodeConfig) {
  const { refetch, fallbackInstance } = config;
  const tSearch = useTranslations("toast.search");
  const tDelete = useTranslations("toast.delete");

  const targetInstance = (s: FlaggedSeries): number => {
    const candidate = (s as FlaggedSeries & { __instanceId?: unknown }).__instanceId;
    return typeof candidate === "number" ? candidate : fallbackInstance;
  };

  const seasonSearch = useMutation({
    mutationFn: ({ series, seasonNumber }: { series: FlaggedSeries; seasonNumber: number }) =>
      api.post<ActionLog>(`/sonarr/series/season-search`, {
        instanceId: targetInstance(series),
        mediaId: series.id,
        seasonNumber,
        title: `${series.title} — Season ${seasonNumber}`,
      }),
    onSuccess: (r) => {
      if (r.isDryRun) toast.info(tSearch("seasonQueuedDryRun"));
      else toast.success(tSearch("seasonStarted"));
    },
    onError: () => toast.error(tSearch("seasonFailed")),
  });

  const episodeSearch = useMutation({
    mutationFn: ({ series, fileId, label }: { series: FlaggedSeries; fileId: number; label: string }) =>
      api.post<ActionLog>(`/sonarr/series/episode-search`, {
        instanceId: targetInstance(series),
        mediaId: series.id,
        fileId,
        title: `${series.title} — ${label}`,
      }),
    onSuccess: (r) => {
      if (r.isDryRun) toast.info(tSearch("episodeQueuedDryRun"));
      else toast.success(tSearch("episodeStarted"));
    },
    onError: (e: Error) => toast.error(e.message || tSearch("episodeFailed")),
  });

  const seasonDelete = useMutation({
    mutationFn: ({ series, seasonNumber, fileIds, search }: {
      series: FlaggedSeries; seasonNumber: number; fileIds: number[]; search: boolean;
    }) =>
      api.post<ActionLog>(`/sonarr/series/delete`, {
        instanceId: targetInstance(series),
        mediaId: series.id,
        fileIds,
        title: `${series.title} — Season ${seasonNumber}`,
        search,
      }),
    onSuccess: (r, vars) => {
      if (r.isDryRun) toast.info(vars.search ? tDelete("queuedAndSearchDryRun") : tDelete("queuedDryRun"));
      else {
        toast.success(vars.search ? tDelete("seasonDoneAndSearch") : tDelete("seasonDone"));
        void refetch();
      }
    },
    onError: () => toast.error(tDelete("seasonFailed")),
  });

  const episodeDelete = useMutation({
    mutationFn: ({ series, fileId, label, search }: {
      series: FlaggedSeries; fileId: number; label: string; search: boolean;
    }) =>
      api.post<ActionLog>(`/sonarr/series/delete`, {
        instanceId: targetInstance(series),
        mediaId: series.id,
        fileIds: [fileId],
        title: `${series.title} — ${label}`,
        search,
      }),
    onSuccess: (r, vars) => {
      if (r.isDryRun) toast.info(vars.search ? tDelete("queuedAndSearchDryRun") : tDelete("queuedDryRun"));
      else {
        toast.success(vars.search ? tDelete("fileDoneAndSearch") : tDelete("fileDone"));
        void refetch();
      }
    },
    onError: () => toast.error(tDelete("fileFailed")),
  });

  return {
    runSearchSeason: (series: FlaggedSeries, seasonNumber: number) =>
      seasonSearch.mutateAsync({ series, seasonNumber }),
    runSearchEpisode: (series: FlaggedSeries, fileId: number, label: string) =>
      episodeSearch.mutateAsync({ series, fileId, label }),
    runDeleteSeason: (series: FlaggedSeries, seasonNumber: number, fileIds: number[], search: boolean) =>
      seasonDelete.mutateAsync({ series, seasonNumber, fileIds, search }),
    runDeleteEpisode: (series: FlaggedSeries, fileId: number, label: string, search: boolean) =>
      episodeDelete.mutateAsync({ series, fileId, label, search }),
  };
}
