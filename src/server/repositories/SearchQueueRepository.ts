import type { SearchQueueAction, SearchQueueEntry, SearchQueueStatus } from "@/shared/types/models";
import { BaseRepository } from "./BaseRepository";

const RETENTION_CAP = Number(process.env.SEARCH_QUEUE_RETENTION_CAP ?? 5000);

interface CreateInput {
  instanceId: number;
  action: SearchQueueAction;
  mediaId: number;
  payload: string;
  title: string;
}

export class SearchQueueRepository extends BaseRepository<SearchQueueEntry> {
  async findById(id: number): Promise<SearchQueueEntry | null> {
    const row = await this.db.searchQueue.findUnique({ where: { id } });
    return row as SearchQueueEntry | null;
  }

  async findAll(): Promise<SearchQueueEntry[]> {
    return (await this.db.searchQueue.findMany({ orderBy: { createdAt: "asc" } })) as SearchQueueEntry[];
  }

  async create(data: CreateInput): Promise<SearchQueueEntry> {
    const created = await this.db.searchQueue.create({ data });
    await this.trim();
    return created as SearchQueueEntry;
  }

  async update(id: number, data: Partial<SearchQueueEntry>): Promise<SearchQueueEntry> {
    return (await this.db.searchQueue.update({ where: { id }, data })) as SearchQueueEntry;
  }

  async delete(id: number): Promise<void> {
    await this.db.searchQueue.delete({ where: { id } });
  }

  async findNextPending(instanceId: number): Promise<SearchQueueEntry | null> {
    const row = await this.db.searchQueue.findFirst({
      where: { instanceId, status: "pending" },
      orderBy: { createdAt: "asc" },
    });
    return row as SearchQueueEntry | null;
  }

  async findPendingByInstance(instanceId: number): Promise<SearchQueueEntry[]> {
    return (await this.db.searchQueue.findMany({
      where: { instanceId, status: "pending" },
      orderBy: { createdAt: "asc" },
    })) as SearchQueueEntry[];
  }

  async findPendingMatching(
    instanceId: number,
    action: SearchQueueAction,
    mediaId: number,
  ): Promise<SearchQueueEntry[]> {
    return (await this.db.searchQueue.findMany({
      where: { instanceId, action, mediaId, status: "pending" },
      orderBy: { createdAt: "asc" },
    })) as SearchQueueEntry[];
  }

  async findAllPending(): Promise<SearchQueueEntry[]> {
    return (await this.db.searchQueue.findMany({
      where: { status: "pending" },
      orderBy: { createdAt: "asc" },
    })) as SearchQueueEntry[];
  }

  async deletePendingByInstance(instanceId: number): Promise<number> {
    const result = await this.db.searchQueue.deleteMany({
      where: { instanceId, status: "pending" },
    });
    return result.count;
  }

  async countPending(instanceId: number): Promise<number> {
    return this.db.searchQueue.count({ where: { instanceId, status: "pending" } });
  }

  async setStatus(
    id: number,
    status: SearchQueueStatus,
    error?: string | null
  ): Promise<SearchQueueEntry> {
    return (await this.db.searchQueue.update({
      where: { id },
      data: { status, error: error ?? null, processedAt: new Date() },
    })) as SearchQueueEntry;
  }

  /**
   * Drop oldest terminal (done / failed) rows past the retention cap.
   * Pending rows are never trimmed — losing them would silently lose
   * user intent.
   */
  private async trim(): Promise<void> {
    const total = await this.db.searchQueue.count({ where: { status: { not: "pending" } } });
    if (total <= RETENTION_CAP) return;
    const overflow = total - RETENTION_CAP;
    const oldest = await this.db.searchQueue.findMany({
      where: { status: { not: "pending" } },
      orderBy: { createdAt: "asc" },
      take: overflow,
      select: { id: true },
    });
    if (oldest.length === 0) return;
    await this.db.searchQueue.deleteMany({ where: { id: { in: oldest.map((r) => r.id) } } });
  }
}

export const searchQueueRepository = new SearchQueueRepository();
