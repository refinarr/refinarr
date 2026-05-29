import type { ConfigSpec } from "@/server/config/keys";
import { BaseRepository } from "./BaseRepository";

interface AppConfig {
  key: string;
  value: string;
}

class ConfigRepository extends BaseRepository<AppConfig> {
  async findById(_id: number): Promise<AppConfig | null> {
    return null;
  }

  async findAll(): Promise<AppConfig[]> {
    return this.db.appConfig.findMany();
  }

  async get(key: string): Promise<string | null> {
    const record = await this.db.appConfig.findUnique({ where: { key } });
    return record?.value ?? null;
  }

  async set(key: string, value: string): Promise<AppConfig> {
    return this.db.appConfig.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }

  async getTyped<T>(spec: ConfigSpec<T>): Promise<T> {
    const raw = await this.get(spec.key);
    if (raw === null) return spec.default;
    return spec.parse(raw);
  }

  async setTyped<T>(spec: ConfigSpec<T>, value: T): Promise<void> {
    await this.set(spec.key, spec.encode(value));
  }

  async create(data: Omit<AppConfig, "id" | "createdAt">): Promise<AppConfig> {
    return this.db.appConfig.create({ data });
  }

  async update(_id: number, _data: Partial<AppConfig>): Promise<AppConfig> {
    throw new Error("Use set(key, value) instead");
  }

  async delete(_id: number): Promise<void> {
    throw new Error("Use db.appConfig.delete directly");
  }
}

export const configRepository = new ConfigRepository();
