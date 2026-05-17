import { dryRunService } from "@/server/services/DryRunService";
import { searchQueueService } from "@/server/services/SearchQueueService";
import {
  parseDispatchExtras,
  type SearchDispatchInput,
} from "@/server/arr/composition";

export interface SearchDispatchResult {
  kind: "queued";
  queueId: number;
  // Carried so the client can pick the right toast variant ("queued for
  // dry-run preview" vs "search started"). The queue worker is what
  // actually records the dry-run ActionLog when it drains the entry.
  isDryRun: boolean;
}

class SearchDispatcher {
  // ALWAYS routes through the queue, including in dry-run mode. This keeps
  // manual searches consistent with the auto-runner (which always enqueues)
  // and gives users a single, visible pipeline. The worker handles the
  // dry-run vs live branch when it drains: in dry-run, executeAction inside
  // the service writes a "dry_run" ActionLog row and skips the upstream
  // call; in live mode it dispatches normally and stamps the commandId.
  async dispatch(input: SearchDispatchInput): Promise<SearchDispatchResult> {
    const isDryRun = await dryRunService.isDryRun();
    const entry = await searchQueueService.enqueue({
      instance: input.instance,
      action: input.action,
      mediaId: input.mediaId,
      title: input.title,
      groupId: input.groupId,
      payload: this.queuePayload(input),
    });
    return { kind: "queued", queueId: entry.id, isDryRun };
  }

  // Validates and extracts the arr-specific extras via the owning
  // module's zod schema. Unknown keys (e.g. from a TS-bypassed caller
  // with stray fields) are stripped — only the schema-declared shape
  // survives into `SearchQueue.payload`. Returns undefined for actions
  // with no extras so the row's payload column gets `"{}"` not `"{...}"`.
  private queuePayload(
    input: SearchDispatchInput,
  ): Record<string, unknown> | undefined {
    const parsed = parseDispatchExtras(
      input.instance.type,
      input.action,
      input,
    );
    return Object.keys(parsed).length === 0 ? undefined : parsed;
  }
}

export const searchDispatcher = new SearchDispatcher();
