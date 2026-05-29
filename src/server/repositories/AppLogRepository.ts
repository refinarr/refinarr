import type { AppLogEntry, LogLevel } from "@/shared/types/models";
import { BaseRepository } from "./BaseRepository";

const RETENTION_CAP = Number(process.env.LOG_RETENTION_CAP) || 5000;

interface AppLogFilter {
  level?: LogLevel;
  q?: string;
  source?: string;
  instanceId?: number;
}

export class AppLogRepository extends BaseRepository<AppLogEntry> {
  async findById(id: number): Promise<AppLogEntry | null> {
    return this.db.appLog.findUnique({
      where: { id },
    }) as Promise<AppLogEntry | null>;
  }

  async findAll(): Promise<AppLogEntry[]> {
    return this.db.appLog.findMany({
      orderBy: { createdAt: "desc" },
    }) as Promise<AppLogEntry[]>;
  }

  async findPaginated(
    filter: AppLogFilter,
    page: number,
    limit: number,
  ): Promise<{ items: AppLogEntry[]; total: number }> {
    const where = {
      ...(filter.level ? { level: filter.level } : {}),
      ...(filter.source ? { source: filter.source } : {}),
      ...(filter.instanceId !== undefined
        ? { instanceId: filter.instanceId }
        : {}),
      ...(filter.q ? { message: { contains: filter.q } } : {}),
    };

    const [items, total] = await Promise.all([
      this.db.appLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.db.appLog.count({ where }),
    ]);

    return { items: items as AppLogEntry[], total };
  }

  async findSince(
    lastId: number,
    filter?: {
      level?: LogLevel | null;
      q?: string;
      source?: string;
      instanceId?: number;
    },
  ): Promise<AppLogEntry[]> {
    const where = {
      id: { gt: lastId },
      ...(filter?.level ? { level: filter.level } : {}),
      ...(filter?.source ? { source: filter.source } : {}),
      ...(filter?.instanceId !== undefined
        ? { instanceId: filter.instanceId }
        : {}),
      ...(filter?.q ? { message: { contains: filter.q } } : {}),
    };
    return this.db.appLog.findMany({
      where,
      orderBy: { id: "asc" },
      take: 200,
    }) as Promise<AppLogEntry[]>;
  }

  async findLatest(
    limit: number,
    filter?: {
      level?: LogLevel | null;
      q?: string;
      source?: string;
      instanceId?: number;
    },
  ): Promise<AppLogEntry[]> {
    const where = {
      ...(filter?.level ? { level: filter.level } : {}),
      ...(filter?.source ? { source: filter.source } : {}),
      ...(filter?.instanceId !== undefined
        ? { instanceId: filter.instanceId }
        : {}),
      ...(filter?.q ? { message: { contains: filter.q } } : {}),
    };
    const rows = await this.db.appLog.findMany({
      where,
      orderBy: { id: "desc" },
      take: limit,
    });
    return (rows as AppLogEntry[]).reverse();
  }

  // `instanceId` is optional on the create input so call sites without a
  // useful instance association (auth, db, generic ops) can omit it.
  // app-logger lifts `context.instanceId` to this column when present.
  async create(
    data: Omit<AppLogEntry, "id" | "createdAt" | "instanceId"> & {
      instanceId?: number | null;
    },
  ): Promise<AppLogEntry> {
    const entry = await this.db.appLog.create({ data });
    void this.trim();
    return entry as AppLogEntry;
  }

  async update(_id: number, _data: Partial<AppLogEntry>): Promise<AppLogEntry> {
    throw new Error("AppLog entries are immutable");
  }

  async delete(id: number): Promise<void> {
    await this.db.appLog.delete({ where: { id } });
  }

  async clearAll(): Promise<void> {
    await this.db.appLog.deleteMany({});
  }

  private async trim(): Promise<void> {
    const total = await this.db.appLog.count();
    if (total <= RETENTION_CAP) return;
    const overflow = total - RETENTION_CAP;
    const oldest = await this.db.appLog.findMany({
      orderBy: { createdAt: "asc" },
      take: overflow,
      select: { id: true },
    });
    if (oldest.length === 0) return;
    await this.db.appLog.deleteMany({
      where: { id: { in: oldest.map((e) => e.id) } },
    });
  }
}

export const appLogRepository = new AppLogRepository();
