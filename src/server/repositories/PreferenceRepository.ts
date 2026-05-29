import type { CfPreference } from "@/shared/types/models";
import { BaseRepository } from "./BaseRepository";

class PreferenceRepository extends BaseRepository<CfPreference> {
  async findById(id: number): Promise<CfPreference | null> {
    return this.db.cfPreference.findUnique({
      where: { id },
    }) as Promise<CfPreference | null>;
  }

  async findAll(): Promise<CfPreference[]> {
    return this.db.cfPreference.findMany() as Promise<CfPreference[]>;
  }

  async findByInstance(instanceId: number): Promise<CfPreference[]> {
    return this.db.cfPreference.findMany({ where: { instanceId } }) as Promise<
      CfPreference[]
    >;
  }

  async setForInstance(
    instanceId: number,
    cfs: Array<{ cfId: number; cfName: string }>,
  ): Promise<void> {
    await this.db.cfPreference.deleteMany({ where: { instanceId } });
    if (cfs.length > 0) {
      await this.db.cfPreference.createMany({
        data: cfs.map((cf) => ({
          instanceId,
          cfId: cf.cfId,
          cfName: cf.cfName,
        })),
      });
    }
  }

  async create(data: Omit<CfPreference, "id">): Promise<CfPreference> {
    return this.db.cfPreference.create({ data }) as Promise<CfPreference>;
  }

  async update(
    _id: number,
    _data: Partial<CfPreference>,
  ): Promise<CfPreference> {
    throw new Error("Use setForInstance instead");
  }

  async delete(id: number): Promise<void> {
    await this.db.cfPreference.delete({ where: { id } });
  }
}

export const preferenceRepository = new PreferenceRepository();
