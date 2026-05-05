import type { ActionLog, ActionType, FlaggedMedia, MediaQuery, ScoringMode } from "@/shared/types/models";
import { SCORE_FOR } from "@/shared/scoring-mode";
import { logRepository } from "@/server/repositories/LogRepository";
import { dryRunService } from "./DryRunService";
import { appLogger } from "@/server/lib/app-logger";
import { LogSource } from "@/server/lib/log-sources";
import { dataCache } from "@/server/lib/DataCache";


interface ExecuteActionOptions {
  instanceId: number;
  instanceName: string;
  action: ActionType;
  mediaId: number;
  title: string;
  payload?: Record<string, unknown>;
  run: () => Promise<void>;
}

// Single source for the human-readable log subject — keeps [DryRun],
// success, and error messages consistent (action: title [instanceName]).
function describe(opts: ExecuteActionOptions): string {
  return `${opts.action}: ${opts.title} [${opts.instanceName}]`;
}

function logContext(opts: ExecuteActionOptions, isDryRun: boolean) {
  return {
    action: opts.action,
    mediaId: opts.mediaId,
    title: opts.title,
    instanceId: opts.instanceId,
    instanceName: opts.instanceName,
    isDryRun,
  };
}

function compareMedia<T extends FlaggedMedia>(
  a: T,
  b: T,
  sortBy: MediaQuery["sortBy"],
  mode: ScoringMode,
  dir: 1 | -1,
  hasFile: (item: T) => boolean,
): number {
  if (sortBy === "added") return 0;
  if (sortBy === "title") return a.title.localeCompare(b.title) * dir;
  // Items without a file sink to the bottom regardless of sort direction so
  // the "worst N" view is never polluted by entries with no on-disk reference.
  const aHas = hasFile(a);
  const bHas = hasFile(b);
  if (aHas !== bHas) return aHas ? -1 : 1;
  if (!aHas) return 0;
  if (sortBy === "score") {
    const av = SCORE_FOR[mode](a);
    const bv = SCORE_FOR[mode](b);
    return (av - bv) * dir;
  }
  return (a.sizeOnDisk - b.sizeOnDisk) * dir;
}

export abstract class MediaService {
  protected applyQuery<T extends FlaggedMedia>(
    source: T[],
    query: MediaQuery,
    mode: ScoringMode,
    hasFile: (item: T) => boolean,
  ): { items: T[]; total: number } {
    let flagged = source;

    if (query.onlyMissing) {
      flagged = flagged.filter((m) => !hasFile(m));
    }

    const maxScore = query.maxScore;
    if (maxScore !== undefined) {
      // Filter against the same accessor the score sort uses, so the
      // "max score" slider behaves consistently across modes.
      const scoreOf = SCORE_FOR[mode];
      flagged = flagged.filter((m) => scoreOf(m) <= maxScore);
    }

    if (query.q) {
      const q = query.q.toLowerCase();
      flagged = flagged.filter(
        (m) =>
          m.title.toLowerCase().includes(q) ||
          m.missingFormats.some((cf) => cf.name.toLowerCase().includes(q)),
      );
    }

    if (query.profileId !== undefined) {
      flagged = flagged.filter((m) => m.qualityProfileId === query.profileId);
    }

    if (query.missingCfIds && query.missingCfIds.length > 0) {
      const wanted = query.missingCfIds;
      const matchAll = (query.missingCfMatch ?? "all") === "all";
      flagged = flagged.filter((m) => {
        const have = new Set(m.missingFormats.map((cf) => cf.id));
        return matchAll ? wanted.every((id) => have.has(id)) : wanted.some((id) => have.has(id));
      });
    }

    if (query.hasNegativeCfIds && query.hasNegativeCfIds.length > 0) {
      const wanted = query.hasNegativeCfIds;
      const matchAll = (query.hasNegativeCfMatch ?? "all") === "all";
      flagged = flagged.filter((m) => {
        const have = new Set(m.unwantedFormats.map((cf) => cf.id));
        return matchAll ? wanted.every((id) => have.has(id)) : wanted.some((id) => have.has(id));
      });
    }

    const dir = query.order === "asc" ? 1 : -1;
    const sorted = [...flagged].sort((a, b) =>
      compareMedia(a, b, query.sortBy, mode, dir, hasFile),
    );

    const total = sorted.length;
    const start = (query.page - 1) * query.limit;
    return { items: sorted.slice(start, start + query.limit), total };
  }

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
      appLogger.info(`[DryRun] ${describe(opts)}`, {
        source: LogSource.MediaAction,
        context: logContext(opts, true),
      });
      return logEntry;
    }

    try {
      await opts.run();
      // Bust the flagged-media cache so the UI sees the post-action state on
      // the next read (deleted/searched item gone) instead of the previous
      // 5-minute snapshot. Dry runs and failed actions don't invalidate —
      // upstream state didn't change.
      dataCache.invalidate(opts.instanceId);
      appLogger.info(`[Run] ${describe(opts)}`, {
        source: LogSource.MediaAction,
        context: logContext(opts, false),
      });
      return logRepository.update(logEntry.id, { status: "success" });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      appLogger.error(`Media action failed: ${describe(opts)}`, {
        source: LogSource.MediaAction,
        err,
        context: logContext(opts, false),
      });
      return logRepository.update(logEntry.id, { status: "failed", error });
    }
  }
}
