import type { SearchQueueAction, SearchQueueEntry, SearchQueueStatus } from "@/shared/types/models";
import { BaseRepository } from "./BaseRepository";
import { appLogger } from "@/server/lib/app-logger";
import { LogSource } from "@/server/lib/log-sources";

const _retentionEnv = parseInt(process.env.SEARCH_QUEUE_RETENTION_CAP ?? "", 10);
const RETENTION_CAP = Number.isFinite(_retentionEnv) && _retentionEnv > 0 ? _retentionEnv : 5000;

function isUniqueConstraintError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "P2002"
  );
}

interface CreateInput {
  instanceId: number;
  action: SearchQueueAction;
  mediaId: number;
  payload: string;
  title: string;
  seasonNumber: number;
  fileId: number;
}

export interface CreateResult {
  entry: SearchQueueEntry;
  /** false when the DB unique constraint fired and we returned the existing pending row */
  created: boolean;
}

export class SearchQueueRepository extends BaseRepository<SearchQueueEntry> {
  async findById(id: number): Promise<SearchQueueEntry | null> {
    const row = await this.db.searchQueue.findUnique({ where: { id } });
    return row as SearchQueueEntry | null;
  }

  async findAll(): Promise<SearchQueueEntry[]> {
    return (await this.db.searchQueue.findMany({ orderBy: { createdAt: "asc" } })) as SearchQueueEntry[];
  }

  async create(data: Omit<SearchQueueEntry, "id" | "createdAt">): Promise<SearchQueueEntry> {
    const entry = await this.db.searchQueue.create({ data });
    return entry as SearchQueueEntry;
  }

  /** Dedup-aware insert: catches P2002 from the partial unique index and
   *  returns the existing pending row with `created: false`. */
  async createUnique(data: CreateInput): Promise<CreateResult> {
    try {
      const entry = await this.db.searchQueue.create({ data });
      this.trim().catch((err) => appLogger.warn("SearchQueue trim failed", { source: LogSource.Db, err }));
      return { entry: entry as SearchQueueEntry, created: true };
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        // Partial unique index violation — a pending row with this identity
        // already exists. Return it so the caller is idempotent.
        const existing = await this.db.searchQueue.findFirst({
          where: {
            instanceId: data.instanceId,
            action: data.action,
            mediaId: data.mediaId,
            seasonNumber: data.seasonNumber,
            fileId: data.fileId,
            status: "pending",
          },
        });
        if (existing) return { entry: existing as SearchQueueEntry, created: false };
      }
      throw err;
    }
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

  async findLastProcessedAt(instanceId: number): Promise<Date | null> {
    const row = await this.db.searchQueue.findFirst({
      where: { instanceId, status: { in: ["done", "failed"] } },
      orderBy: { processedAt: "desc" },
      select: { processedAt: true },
    });
    return row?.processedAt ?? null;
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
      orderBy: [{ processedAt: "asc" }, { createdAt: "asc" }],
      take: overflow,
      select: { id: true },
    });
    if (oldest.length === 0) return;
    await this.db.searchQueue.deleteMany({ where: { id: { in: oldest.map((r) => r.id) } } });
  }
}

export const searchQueueRepository = new SearchQueueRepository();
