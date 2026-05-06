import { encryptSecret, decryptSecret, isEncrypted } from "@/server/lib/crypto";
import type { Instance, ScoringMode } from "@/shared/types/models";
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
  createdAt: Date;
}

function toInstance(row: RawInstanceRow): Instance {
  return { ...row, apiKey: decryptSecret(row.apiKey) } as Instance;
}

// Both columns have DB-level defaults, so callers don't need to provide
// them on create — the column will fill in.
type CreateInstanceInput = Omit<
  Instance,
  "id" | "createdAt" | "scoringMode" | "searchesPerHour"
> & {
  scoringMode?: ScoringMode;
  searchesPerHour?: number;
};

export class InstanceRepository extends BaseRepository<Instance> {
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
