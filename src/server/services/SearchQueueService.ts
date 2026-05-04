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
    const existing = await this.findPendingDuplicate(input);
    if (existing) {
      appLogger.info("Search enqueue deduped", {
        source: LogSource.SearchQueue,
        context: {
          existingId: existing.id,
          instanceId: existing.instanceId,
          action: existing.action,
          mediaId: existing.mediaId,
          title: existing.title,
        },
      });
      return existing;
    }

    const row = await searchQueueRepository.create({
      instanceId: input.instanceId,
      action: input.action,
      mediaId: input.mediaId,
      title: input.title,
      payload: JSON.stringify(input.payload ?? {}),
    });
    appLogger.info("Search enqueued", {
      source: LogSource.SearchQueue,
      context: {
        id: row.id,
        instanceId: row.instanceId,
        action: row.action,
        mediaId: row.mediaId,
        title: row.title,
      },
    });
    // Poke the worker so the first enqueue drains immediately if the rate
    // budget allows. Rapid follow-up enqueues see a recent lastProcessedAt
    // and skip; the setInterval paces them out per searchesPerHour.
    void searchWorker.kick(input.instanceId);
    eventBus.emit({ type: "queue-changed", instanceId: input.instanceId });
    return row;
  }

  // Returns an existing pending row that matches the request, or null.
  // For movie/series, (instanceId, action, mediaId) is enough. For season /
  // episode-file the same series is valid for many seasons / files, so we
  // disambiguate via the payload key the worker reads later.
  private async findPendingDuplicate(input: EnqueueInput): Promise<SearchQueueEntry | null> {
    const candidates = await searchQueueRepository.findPendingMatching(
      input.instanceId,
      input.action,
      input.mediaId,
    );
    if (candidates.length === 0) return null;
    if (input.action === "movie" || input.action === "series") return candidates[0];
    const key = input.action === "season" ? "seasonNumber" : "fileId";
    const wanted = input.payload?.[key];
    if (wanted === undefined) return null;
    return candidates.find((row) => {
      try {
        const payload = JSON.parse(row.payload) as Record<string, unknown>;
        return payload[key] === wanted;
      } catch {
        return false;
      }
    }) ?? null;
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
    const rate = instance?.searchesPerHour ?? 1;
    // First pending row fires on the next tick (effectively now); subsequent
    // ones each take 1 hour / rate. ETA is for the LAST pending row to fire.
    const minDelayMs = 3_600_000 / Math.max(1, rate);
    return { pendingCount, etaMs: (pendingCount - 1) * minDelayMs };
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
