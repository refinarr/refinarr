import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { api } from "@/client/lib/api";
import { queryKeys } from "@/client/lib/query-keys";
import { withToast } from "@/client/lib/with-toast";
import type { ActionLog, SeriesItem } from "@/shared/types/models";

export interface SeasonEpisodeConfig {
  instanceId: number;
  refetch: () => unknown;
}

export function useShowSeasonEpisodeActions(config: SeasonEpisodeConfig) {
  const { refetch, instanceId } = config;
  const qc = useQueryClient();
  const tSearch = useTranslations("toast.search");
  const tDelete = useTranslations("toast.delete");

  const invalidateQueue = () => {
    qc.invalidateQueries({ queryKey: queryKeys.searchQueue(instanceId) });
    qc.invalidateQueries({ queryKey: queryKeys.searchQueueAll() });
  };

  const seasonSearch = useMutation({
    mutationFn: ({
      series,
      seasonNumber,
    }: {
      series: SeriesItem;
      seasonNumber: number;
    }) =>
      api.post<ActionLog>(`/sonarr/series/season-search`, {
        instanceId,
        mediaId: series.id,
        seasonNumber,
        title: `${series.title} — Season ${seasonNumber}`,
      }),
    onSuccess: () => {
      invalidateQueue();
    },
  });

  const episodeSearch = useMutation({
    mutationFn: ({
      series,
      fileId,
      label,
    }: {
      series: SeriesItem;
      fileId: number;
      label: string;
    }) =>
      api.post<ActionLog>(`/sonarr/series/episode-search`, {
        instanceId,
        mediaId: series.id,
        fileId,
        title: `${series.title} — ${label}`,
      }),
    onSuccess: () => {
      invalidateQueue();
    },
  });

  const seasonDelete = useMutation({
    mutationFn: ({
      series,
      seasonNumber,
      fileIds,
    }: {
      series: SeriesItem;
      seasonNumber: number;
      fileIds: number[];
    }) =>
      api.post<ActionLog>(`/sonarr/series/delete`, {
        instanceId,
        mediaId: series.id,
        fileIds,
        title: `${series.title} — Season ${seasonNumber}`,
      }),
    onSuccess: (r) => {
      if (!r.isDryRun) void refetch();
    },
  });

  const episodeDelete = useMutation({
    mutationFn: ({
      series,
      fileId,
      label,
    }: {
      series: SeriesItem;
      fileId: number;
      label: string;
    }) =>
      api.post<ActionLog>(`/sonarr/series/delete`, {
        instanceId,
        mediaId: series.id,
        fileIds: [fileId],
        title: `${series.title} — ${label}`,
      }),
    onSuccess: (r) => {
      if (!r.isDryRun) void refetch();
    },
  });

  const searchSeasonWithToast = withToast(seasonSearch, {
    success: (r) =>
      r.isDryRun ? tSearch("seasonQueuedDryRun") : tSearch("seasonStarted"),
    error: tSearch("seasonFailed"),
  });
  const searchEpisodeWithToast = withToast(episodeSearch, {
    success: (r) =>
      r.isDryRun ? tSearch("episodeQueuedDryRun") : tSearch("episodeStarted"),
    error: (e) => (e instanceof Error ? e.message : tSearch("episodeFailed")),
  });
  const getSeasonDeleteMessage = (r: ActionLog) => {
    if (r.isDryRun) return tDelete("queuedDryRun");
    return tDelete("seasonDone");
  };
  const getEpisodeDeleteMessage = (r: ActionLog) => {
    if (r.isDryRun) return tDelete("queuedDryRun");
    return tDelete("fileDone");
  };
  const deleteSeasonWithToast = withToast(seasonDelete, {
    success: getSeasonDeleteMessage,
    error: tDelete("seasonFailed"),
  });
  const deleteEpisodeWithToast = withToast(episodeDelete, {
    success: getEpisodeDeleteMessage,
    error: tDelete("fileFailed"),
  });

  return {
    runSearchSeason: (series: SeriesItem, seasonNumber: number) =>
      searchSeasonWithToast({ series, seasonNumber }),
    runSearchEpisode: (series: SeriesItem, fileId: number, label: string) =>
      searchEpisodeWithToast({ series, fileId, label }),
    runDeleteSeason: (
      series: SeriesItem,
      seasonNumber: number,
      fileIds: number[],
    ) => deleteSeasonWithToast({ series, seasonNumber, fileIds }),
    runDeleteEpisode: (series: SeriesItem, fileId: number, label: string) =>
      deleteEpisodeWithToast({ series, fileId, label }),
  };
}
