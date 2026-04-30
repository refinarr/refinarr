import type { Instance } from "@/shared/types/models";
import { BaseRepository } from "./BaseRepository";

export class InstanceRepository extends BaseRepository<Instance> {
  async findById(id: number): Promise<Instance | null> {
    return this.db.instance.findUnique({ where: { id } }) as Promise<Instance | null>;
  }

  async findAll(): Promise<Instance[]> {
    return this.db.instance.findMany({ orderBy: { createdAt: "asc" } }) as Promise<Instance[]>;
  }

  async findAllEnabled(): Promise<Instance[]> {
    return this.db.instance.findMany({
      where: { enabled: true },
      orderBy: { createdAt: "asc" },
    }) as Promise<Instance[]>;
  }

  async create(data: Omit<Instance, "id" | "createdAt">): Promise<Instance> {
    return this.db.instance.create({ data }) as Promise<Instance>;
  }

  async update(id: number, data: Partial<Instance>): Promise<Instance> {
    return this.db.instance.update({ where: { id }, data }) as Promise<Instance>;
  }

  async delete(id: number): Promise<void> {
    await this.db.instance.delete({ where: { id } });
  }
}

export const instanceRepository = new InstanceRepository();
