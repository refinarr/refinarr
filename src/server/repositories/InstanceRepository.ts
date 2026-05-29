import { encryptSecret, decryptSecret, isEncrypted } from "@/server/lib/crypto";
import { isAutoSearchScoringMode } from "@/shared/scoring-mode";
import type {
  ArrType,
  AutoSearchPickStrategy,
  AutoSearchScheduleMode,
  AutoSearchScope,
  AutoSearchScoringMode,
  Instance,
  ScoringMode,
} from "@/shared/types/models";
import { BaseRepository } from "./BaseRepository";

interface RawInstanceRow {
  id: number;
  type: string;
  name: string;
  url: string;
  apiKey: string;
  enabled: boolean;
  scoringMode: string;
  searchesPerHour: number;
  showAllMedia: boolean;
  createdAt: Date;
  autoSearchEnabled: boolean;
  autoSearchScheduleMode: string;
  autoSearchIntervalMinutes: number;
  autoSearchCronExpression: string;
  autoSearchBatchLimit: number;
  autoSearchLastRunAt: Date | null;
  autoSearchMonitoredOnly: boolean;
  autoSearchScope: string;
  autoSearchPickStrategy: string;
  autoSearchCooldownHours: number;
  autoSearchPausedUntil: Date | null;
  autoSearchScoringMode: string;
  autoSearchFailedStreak: number;
}

function toAutoSearchScoringMode(v: string): AutoSearchScoringMode {
  return isAutoSearchScoringMode(v) ? v : "inherit";
}

function toInstance(row: RawInstanceRow): Instance {
  return {
    ...row,
    apiKey: decryptSecret(row.apiKey),
    type: row.type as ArrType,
    scoringMode: row.scoringMode as ScoringMode,
    autoSearchScheduleMode:
      row.autoSearchScheduleMode as AutoSearchScheduleMode,
    autoSearchScope: row.autoSearchScope as AutoSearchScope,
    autoSearchPickStrategy:
      row.autoSearchPickStrategy as AutoSearchPickStrategy,
    autoSearchScoringMode: toAutoSearchScoringMode(row.autoSearchScoringMode),
  };
}

// Columns with DB-level defaults are optional on create — Prisma fills
// them in. Keeps test fixtures from having to spell them out.
type CreateInstanceInput = Omit<
  Instance,
  | "id"
  | "createdAt"
  | "scoringMode"
  | "searchesPerHour"
  | "showAllMedia"
  | "autoSearchEnabled"
  | "autoSearchScheduleMode"
  | "autoSearchIntervalMinutes"
  | "autoSearchCronExpression"
  | "autoSearchBatchLimit"
  | "autoSearchLastRunAt"
  | "autoSearchMonitoredOnly"
  | "autoSearchScope"
  | "autoSearchPickStrategy"
  | "autoSearchCooldownHours"
  | "autoSearchPausedUntil"
  | "autoSearchScoringMode"
  | "autoSearchFailedStreak"
> & {
  scoringMode?: ScoringMode;
  searchesPerHour?: number;
  showAllMedia?: boolean;
  autoSearchEnabled?: boolean;
  autoSearchScheduleMode?: AutoSearchScheduleMode;
  autoSearchIntervalMinutes?: number;
  autoSearchCronExpression?: string;
  autoSearchBatchLimit?: number;
  autoSearchLastRunAt?: Date | null;
  autoSearchMonitoredOnly?: boolean;
  autoSearchScope?: AutoSearchScope;
  autoSearchPickStrategy?: AutoSearchPickStrategy;
  autoSearchCooldownHours?: number;
  autoSearchPausedUntil?: Date | null;
  autoSearchScoringMode?: AutoSearchScoringMode;
  autoSearchFailedStreak?: number;
};

class InstanceRepository extends BaseRepository<Instance> {
  async findById(id: number): Promise<Instance | null> {
    const row = (await this.db.instance.findUnique({
      where: { id },
    })) as RawInstanceRow | null;
    return row ? toInstance(row) : null;
  }

  async findAll(): Promise<Instance[]> {
    const rows = (await this.db.instance.findMany({
      orderBy: { createdAt: "asc" },
    })) as RawInstanceRow[];
    return rows.map(toInstance);
  }

  async findAllEnabled(): Promise<Instance[]> {
    const rows = (await this.db.instance.findMany({
      where: { enabled: true },
      orderBy: { createdAt: "asc" },
    })) as RawInstanceRow[];
    return rows.map(toInstance);
  }

  async create(data: CreateInstanceInput): Promise<Instance> {
    const created = (await this.db.instance.create({
      data: { ...data, apiKey: encryptSecret(data.apiKey) },
    })) as RawInstanceRow;
    return toInstance(created);
  }

  async update(id: number, data: Partial<Instance>): Promise<Instance> {
    const payload: Partial<RawInstanceRow> = { ...data };
    if (typeof data.apiKey === "string") {
      payload.apiKey = encryptSecret(data.apiKey);
    }
    const updated = (await this.db.instance.update({
      where: { id },
      data: payload,
    })) as RawInstanceRow;
    return toInstance(updated);
  }

  async delete(id: number): Promise<void> {
    await this.db.instance.delete({ where: { id } });
  }

  async stampLastRunAt(id: number, when: Date): Promise<void> {
    await this.db.instance.update({
      where: { id },
      data: { autoSearchLastRunAt: when },
    });
  }

  async resetFailedStreak(id: number): Promise<void> {
    await this.db.instance.update({
      where: { id },
      data: { autoSearchFailedStreak: 0 },
    });
  }

  async bumpFailedStreak(id: number): Promise<void> {
    await this.db.instance.update({
      where: { id },
      data: { autoSearchFailedStreak: { increment: 1 } },
    });
  }

  async migrateUnencrypted(): Promise<number> {
    const rows = (await this.db.instance.findMany()) as RawInstanceRow[];
    let migrated = 0;
    for (const row of rows) {
      if (!isEncrypted(row.apiKey)) {
        await this.db.instance.update({
          where: { id: row.id },
          data: { apiKey: encryptSecret(row.apiKey) },
        });
        migrated++;
      }
    }
    return migrated;
  }
}

export const instanceRepository = new InstanceRepository();
