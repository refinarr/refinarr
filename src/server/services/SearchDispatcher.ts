import { dryRunService } from "@/server/services/DryRunService";
import { searchQueueService } from "@/server/services/SearchQueueService";

interface SearchDispatchBase {
  instanceId: number;
  mediaId: number;
  title: string;
  groupId?: string;
}

export interface MovieDispatchInput extends SearchDispatchBase {
  action: "movie";
}

export interface SeriesDispatchInput extends SearchDispatchBase {
  action: "series";
}

export interface SeasonDispatchInput extends SearchDispatchBase {
  action: "season";
  seasonNumber: number;
}

export interface EpisodeDispatchInput extends SearchDispatchBase {
  action: "episode";
  fileId: number;
}

export type SearchDispatchInput =
  | MovieDispatchInput
  | SeriesDispatchInput
  | SeasonDispatchInput
  | EpisodeDispatchInput;

export interface SearchDispatchResult {
  kind: "queued";
  queueId: number;
  // Carried so the client can pick the right toast variant ("queued for
  // dry-run preview" vs "search started"). The queue worker is what
  // actually records the dry-run ActionLog when it drains the entry.
  isDryRun: boolean;
}

export class SearchDispatcher {
  // ALWAYS routes through the queue, including in dry-run mode. This keeps
  // manual searches consistent with the auto-runner (which always enqueues)
  // and gives users a single, visible pipeline. The worker handles the
  // dry-run vs live branch when it drains: in dry-run, executeAction inside
  // the service writes a "dry_run" ActionLog row and skips the upstream
  // call; in live mode it dispatches normally and stamps the commandId.
  async dispatch(input: SearchDispatchInput): Promise<SearchDispatchResult> {
    const isDryRun = await dryRunService.isDryRun();
    const entry = await searchQueueService.enqueue({
      instanceId: input.instanceId,
      action: input.action,
      mediaId: input.mediaId,
      title: input.title,
      groupId: input.groupId,
      payload: this.queuePayload(input),
    });
    return { kind: "queued", queueId: entry.id, isDryRun };
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
