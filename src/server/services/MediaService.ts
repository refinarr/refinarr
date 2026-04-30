import type { ActionLog, ActionStatus, ActionType } from "@/shared/types/models";
import { logRepository } from "@/server/repositories/LogRepository";
import { dryRunService } from "./DryRunService";
import { logger } from "@/server/lib/logger";

interface ExecuteActionOptions {
  instanceId: number;
  action: ActionType;
  mediaId: number;
  title: string;
  payload?: Record<string, unknown>;
  run: () => Promise<void>;
}

export abstract class MediaService {
  protected async executeAction(opts: ExecuteActionOptions): Promise<ActionLog> {
    const isDryRun = await dryRunService.isDryRun();

    const logEntry = await logRepository.create({
      instanceId: opts.instanceId,
      action: opts.action,
      mediaId: opts.mediaId,
      title: opts.title,
      isDryRun,
      status: isDryRun ? "dry_run" : "pending",
      error: null,
      payload: opts.payload ? JSON.stringify(opts.payload) : null,
    });

    if (isDryRun) {
      logger.info({ action: opts.action, mediaId: opts.mediaId }, "[DryRun]");
      return logEntry;
    }

    try {
      await opts.run();
      return logRepository.update(logEntry.id, { status: "success" });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      logger.error({ action: opts.action, mediaId: opts.mediaId, error }, "Action failed");
      return logRepository.update(logEntry.id, { status: "failed", error });
    }
  }

  protected resolveStatus(isDryRun: boolean): ActionStatus {
    return isDryRun ? "dry_run" : "pending";
  }
}
