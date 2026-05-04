import type {
  SearchQueueAction,
  SearchQueueEntry,
} from "@/shared/types/models";
import { searchQueueRepository } from "@/server/repositories/SearchQueueRepository";
import { instanceRepository } from "@/server/repositories/InstanceRepository";
import { searchWorker } from "@/server/lib/search-worker";
import { eventBus } from "@/server/lib/event-bus";
import { appLogger } from "@/server/lib/app-logger";
import { LogSource } from "@/server/lib/log-sources";

interface EnqueueInput {
  instanceId: number;
  action: SearchQueueAction;
  mediaId: number;
  title: string;
  payload?: Record<string, unknown>;
}

export interface QueueStatus {
  pendingCount: number;
  etaMs: number;
}

export class SearchQueueService {
  async enqueue(input: EnqueueInput): Promise<SearchQueueEntry> {
    const seasonNumber = input.action === "season"
      ? (input.payload?.seasonNumber as number | undefined) ?? 0
      : 0;
    const fileId = input.action === "episode-file"
      ? (input.payload?.fileId as number | undefined) ?? 0
      : 0;

    const { entry, created } = await searchQueueRepository.createUnique({
      instanceId: input.instanceId,
      action: input.action,
      mediaId: input.mediaId,
      title: input.title,
      payload: JSON.stringify(input.payload ?? {}),
      seasonNumber,
      fileId,
    });

    if (!created) {
      appLogger.info("Search enqueue deduped", {
        source: LogSource.SearchQueue,
        context: {
          existingId: entry.id,
          instanceId: entry.instanceId,
          action: entry.action,
          mediaId: entry.mediaId,
          title: entry.title,
        },
      });
      return entry;
    }

    appLogger.info("Search enqueued", {
      source: LogSource.SearchQueue,
      context: {
        id: entry.id,
        instanceId: entry.instanceId,
        action: entry.action,
        mediaId: entry.mediaId,
        title: entry.title,
      },
    });
    void searchWorker.kick(input.instanceId);
    eventBus.emit({ type: "queue-changed", instanceId: input.instanceId });
    return entry;
  }

  async findNextPending(instanceId: number): Promise<SearchQueueEntry | null> {
    return searchQueueRepository.findNextPending(instanceId);
  }

  async markDone(id: number): Promise<void> {
    const row = await searchQueueRepository.setStatus(id, "done", null);
    eventBus.emit({ type: "queue-changed", instanceId: row.instanceId });
    eventBus.emit({ type: "history-changed", instanceId: row.instanceId });
  }

  async markFailed(id: number, error: string): Promise<void> {
    const row = await searchQueueRepository.setStatus(id, "failed", error);
    eventBus.emit({ type: "queue-changed", instanceId: row.instanceId });
    eventBus.emit({ type: "history-changed", instanceId: row.instanceId });
  }

  async getStatus(instanceId: number): Promise<QueueStatus> {
    const pendingCount = await searchQueueRepository.countPending(instanceId);
    if (pendingCount === 0) return { pendingCount: 0, etaMs: 0 };
    const instance = await instanceRepository.findById(instanceId);
    if (!instance) {
      // Pending rows for a deleted instance — worker will mark them failed on
      // the next tick. Return count with etaMs=0 so callers see the backlog
      // without a misleading rate-derived ETA.
      return { pendingCount, etaMs: 0 };
    }
    const rate = instance.searchesPerHour;
    const minDelayMs = 3_600_000 / Math.max(1, rate);
    const lastProcessedAt = await searchQueueRepository.findLastProcessedAt(instanceId);
    // How long until the first pending row can fire. When no terminal rows
    // exist (never processed), treat elapsed = minDelayMs so remainingFirstDelay
    // = 0 — matches the optimistic "fires immediately on kick()" behaviour.
    const elapsed = lastProcessedAt ? Date.now() - lastProcessedAt.getTime() : minDelayMs;
    const remainingFirstDelay = Math.max(0, minDelayMs - elapsed);
    return { pendingCount, etaMs: remainingFirstDelay + (pendingCount - 1) * minDelayMs };
  }

  async listPending(instanceId: number): Promise<SearchQueueEntry[]> {
    return searchQueueRepository.findPendingByInstance(instanceId);
  }

  async listAllPending(): Promise<SearchQueueEntry[]> {
    return searchQueueRepository.findAllPending();
  }

  async clearPending(instanceId: number): Promise<number> {
    const removed = await searchQueueRepository.deletePendingByInstance(instanceId);
    if (removed > 0) {
      appLogger.info("Search queue cleared", {
        source: LogSource.SearchQueue,
        context: { instanceId, removed },
      });
      eventBus.emit({ type: "queue-cleared", instanceId });
    }
    return removed;
  }
}

export const searchQueueService = new SearchQueueService();
