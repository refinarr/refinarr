import { dryRunService } from "@/server/services/DryRunService";
import { movieService } from "@/server/services/MovieService";
import { seriesService } from "@/server/services/SeriesService";
import { searchQueueService } from "@/server/services/SearchQueueService";
import type { ActionLog } from "@/shared/types/models";

export type SearchDispatchInput =
  | {
      action: "movie";
      instanceId: number;
      mediaId: number;
      title: string;
      groupId?: string;
    }
  | {
      action: "series";
      instanceId: number;
      mediaId: number;
      title: string;
      groupId?: string;
    }
  | {
      action: "season";
      instanceId: number;
      mediaId: number;
      seasonNumber: number;
      title: string;
      groupId?: string;
    }
  | {
      action: "episode";
      instanceId: number;
      mediaId: number;
      fileId: number;
      title: string;
      groupId?: string;
    };

export type SearchDispatchResult =
  | { kind: "dryRun"; actionLog: ActionLog }
  | { kind: "queued"; queueId: number };

export class SearchDispatcher {
  async dispatch(input: SearchDispatchInput): Promise<SearchDispatchResult> {
    if (await dryRunService.isDryRun()) {
      const actionLog = await this.recordDryRun(input);
      return { kind: "dryRun", actionLog };
    }
    const entry = await searchQueueService.enqueue({
      instanceId: input.instanceId,
      action: input.action,
      mediaId: input.mediaId,
      title: input.title,
      groupId: input.groupId,
      payload: this.queuePayload(input),
    });
    return { kind: "queued", queueId: entry.id };
  }

  // Bypasses the queue and calls the service trigger directly. Used only on
  // the dry-run path: executeAction inside the service skips the upstream
  // `run()` callback and writes an ActionLog row with status="dry_run", which
  // we surface back to the client so the History table updates immediately.
  private async recordDryRun(input: SearchDispatchInput): Promise<ActionLog> {
    switch (input.action) {
      case "movie":
        return movieService.triggerSearch(
          input.instanceId,
          input.mediaId,
          input.title,
          { groupId: input.groupId },
        );
      case "series":
        return seriesService.triggerSearch(
          input.instanceId,
          input.mediaId,
          input.title,
          { groupId: input.groupId },
        );
      case "season":
        return seriesService.triggerSeasonSearch(
          input.instanceId,
          input.mediaId,
          input.seasonNumber,
          input.title,
          { groupId: input.groupId },
        );
      case "episode":
        return seriesService.triggerEpisodeFileSearch(
          input.instanceId,
          input.mediaId,
          input.fileId,
          input.title,
          { groupId: input.groupId },
        );
    }
  }

  private queuePayload(
    input: SearchDispatchInput,
  ): Record<string, unknown> | undefined {
    if (input.action === "season") return { seasonNumber: input.seasonNumber };
    if (input.action === "episode") return { fileId: input.fileId };
    return undefined;
  }
}

export const searchDispatcher = new SearchDispatcher();
