import { searchQueueRepository } from "@/server/repositories/SearchQueueRepository";
import { instanceRepository } from "@/server/repositories/InstanceRepository";
import { dedupKeyFor } from "@/server/arr/composition";
import { searchWorker } from "@/server/lib/search-worker";
import { eventBus } from "@/server/lib/event-bus";
import { appLogger } from "@/server/lib/app-logger";
import { LogSource } from "@/shared/types/models";
import type {
  Instance,
  SearchQueueAction,
  SearchQueueEntry,
} from "@/shared/types/models";

interface EnqueueInput {
  // Pair passed together so (id, type) can't disagree. Routes should
  // assertArrType (from @/server/lib/api-errors) before constructing.
  instance: Pick<Instance, "id" | "type">;
  action: SearchQueueAction;
  mediaId: number;
  title: string;
  payload?: Record<string, unknown>;
  // Bulk-submission UUID; propagated to ActionLog.groupId on drain.
  groupId?: string;
}

export interface QueueStatus {
  pendingCount: number;
  etaMs: number;
}

export class SearchQueueService {
  async enqueue(input: EnqueueInput): Promise<SearchQueueEntry> {
    // dedupKeyFor also enforces (action ∈ owning arr's queueActions);
    // a mismatched pair throws here, before any DB write.
    const { id: instanceId, type: arrType } = input.instance;
    const payload = input.payload ?? {};
    const dedupKey = dedupKeyFor(arrType, input.action, payload);

    const { entry, created } = await searchQueueRepository.createUnique({
      instanceId,
      action: input.action,
      mediaId: input.mediaId,
      title: input.title,
      payload: JSON.stringify(payload),
      dedupKey,
      groupId: input.groupId ?? null,
    });

    if (!created) {
      appLogger.info(`Search enqueue deduped: ${entry.title}`, {
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

    appLogger.info(`Search enqueued: ${entry.title}`, {
      source: LogSource.SearchQueue,
      context: {
        id: entry.id,
        instanceId: entry.instanceId,
        action: entry.action,
        mediaId: entry.mediaId,
        title: entry.title,
        groupId: entry.groupId,
      },
    });
    searchWorker.kick(instanceId).catch((err) =>
      appLogger.error("searchWorker.kick failed", {
        source: LogSource.SearchQueue,
        context: { instanceId, err: String(err) },
      }),
    );
    eventBus.emit({ type: "queue-changed", instanceId });
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
    if (!instance || !instance.enabled) {
      // Pending rows for a deleted instance — worker will mark them failed on
      // the next tick. Return count with etaMs=0 so callers see the backlog
      // without a misleading rate-derived ETA.
      return { pendingCount, etaMs: 0 };
    }
    const rate = instance.searchesPerHour;
    const minDelayMs = 3_600_000 / Math.max(1, rate);
    const [lastProcessedAt, nextPending] = await Promise.all([
      searchQueueRepository.findLastProcessedAt(instanceId),
      searchQueueRepository.findNextPending(instanceId),
    ]);
    // If the oldest pending row was enqueued after the last terminal row, the
    // queue was empty when this row arrived — kick() will fire it immediately.
    const queueRestartedAfterDrain =
      !!lastProcessedAt &&
      !!nextPending &&
      nextPending.createdAt.getTime() > lastProcessedAt.getTime();
    // How long until the first pending row can fire. Treat elapsed = minDelayMs
    // (→ remainingFirstDelay = 0) when: never processed, or restarted after drain.
    const elapsed =
      !lastProcessedAt || queueRestartedAfterDrain
        ? minDelayMs
        : Date.now() - lastProcessedAt.getTime();
    const remainingFirstDelay = Math.max(0, minDelayMs - elapsed);
    return {
      pendingCount,
      etaMs: remainingFirstDelay + (pendingCount - 1) * minDelayMs,
    };
  }

  async listPending(instanceId: number): Promise<SearchQueueEntry[]> {
    return searchQueueRepository.findPendingByInstance(instanceId);
  }

  async listAllPending(): Promise<SearchQueueEntry[]> {
    return searchQueueRepository.findAllPending();
  }

  async clearPending(instanceId: number): Promise<number> {
    const removed =
      await searchQueueRepository.deletePendingByInstance(instanceId);
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
