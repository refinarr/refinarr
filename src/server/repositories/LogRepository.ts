import type { ActionLog, ActionStatus, ActionType } from "@/shared/types/models";
import { BaseRepository } from "./BaseRepository";

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

  async create(
    data: Omit<ActionLog, "id" | "createdAt">
  ): Promise<ActionLog> {
    return this.db.actionLog.create({ data }) as Promise<ActionLog>;
  }

  async update(id: number, data: Partial<ActionLog>): Promise<ActionLog> {
    return this.db.actionLog.update({ where: { id }, data }) as Promise<ActionLog>;
  }

  async delete(id: number): Promise<void> {
    await this.db.actionLog.delete({ where: { id } });
  }
}

export const logRepository = new LogRepository();
