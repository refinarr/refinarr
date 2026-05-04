import type { ActionLog, ActionStatus, ActionType } from "@/shared/types/models";
import { BaseRepository } from "./BaseRepository";

const RETENTION_CAP = Number(process.env.ACTION_LOG_RETENTION_CAP) || 5000;

interface LogFilter {
  instanceId?: number;
  status?: ActionStatus;
  action?: ActionType;
}

export class LogRepository extends BaseRepository<ActionLog> {
  async findById(id: number): Promise<ActionLog | null> {
    return this.db.actionLog.findUnique({ where: { id } }) as Promise<ActionLog | null>;
  }

  async findAll(): Promise<ActionLog[]> {
    return this.db.actionLog.findMany({ orderBy: { createdAt: "desc" } }) as Promise<ActionLog[]>;
  }

  async findPaginated(
    filter: LogFilter,
    page: number,
    limit: number
  ): Promise<{ items: ActionLog[]; total: number }> {
    const where = {
      ...(filter.instanceId ? { instanceId: filter.instanceId } : {}),
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.action ? { action: filter.action } : {}),
    };

    const [items, total] = await Promise.all([
      this.db.actionLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.db.actionLog.count({ where }),
    ]);

    return { items: items as ActionLog[], total };
  }

  async findFailedByInstance(instanceId: number): Promise<ActionLog[]> {
    return this.db.actionLog.findMany({
      where: { instanceId, status: "failed" },
      orderBy: { createdAt: "desc" },
    }) as Promise<ActionLog[]>;
  }

  async countByStatusSince(status: ActionStatus, since: Date): Promise<number> {
    return this.db.actionLog.count({
      where: { status, createdAt: { gte: since } },
    });
  }

  async findRecent(limit: number): Promise<ActionLog[]> {
    return this.db.actionLog.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
    }) as Promise<ActionLog[]>;
  }

  /**
   * Per-instance summary used by the "Searched Xm ago" badge: for each
   * mediaId that had a successful search action within `windowMs`, the
   * timestamp of its most recent success. Returned ordered by most recent
   * first so callers that build a Map<mediaId, Date> get the latest entry.
   */
  async findRecentSearches(
    instanceId: number,
    windowMs: number
  ): Promise<Array<{ mediaId: number; lastSearchedAt: Date }>> {
    const since = new Date(Date.now() - windowMs);
    const rows = await this.db.actionLog.findMany({
      where: {
        instanceId,
        action: "search",
        status: "success",
        createdAt: { gte: since },
      },
      orderBy: { createdAt: "desc" },
      select: { mediaId: true, createdAt: true },
    });
    const seen = new Map<number, Date>();
    for (const r of rows) {
      if (!seen.has(r.mediaId)) seen.set(r.mediaId, r.createdAt);
    }
    return [...seen.entries()].map(([mediaId, lastSearchedAt]) => ({ mediaId, lastSearchedAt }));
  }

  async create(
    data: Omit<ActionLog, "id" | "createdAt">
  ): Promise<ActionLog> {
    const created = (await this.db.actionLog.create({ data })) as ActionLog;
    void this.trim();
    return created;
  }

  async update(id: number, data: Partial<ActionLog>): Promise<ActionLog> {
    return this.db.actionLog.update({ where: { id }, data }) as Promise<ActionLog>;
  }

  async delete(id: number): Promise<void> {
    await this.db.actionLog.delete({ where: { id } });
  }

  async clearAll(): Promise<void> {
    await this.db.actionLog.deleteMany({});
  }

  private async trim(): Promise<void> {
    const total = await this.db.actionLog.count();
    if (total <= RETENTION_CAP) return;
    const overflow = total - RETENTION_CAP;
    const oldest = await this.db.actionLog.findMany({
      orderBy: { createdAt: "asc" },
      take: overflow,
      select: { id: true },
    });
    await this.db.actionLog.deleteMany({ where: { id: { in: oldest.map((e) => e.id) } } });
  }
}

export const logRepository = new LogRepository();
