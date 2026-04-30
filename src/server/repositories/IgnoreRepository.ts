import type { IgnoreEntry, MediaType } from "@/shared/types/models";
import { BaseRepository } from "./BaseRepository";

export class IgnoreRepository extends BaseRepository<IgnoreEntry> {
  async findById(id: number): Promise<IgnoreEntry | null> {
    return this.db.ignoreEntry.findUnique({ where: { id } }) as Promise<IgnoreEntry | null>;
  }

  async findAll(): Promise<IgnoreEntry[]> {
    return this.db.ignoreEntry.findMany() as Promise<IgnoreEntry[]>;
  }

  async findByInstance(instanceId: number): Promise<IgnoreEntry[]> {
    return this.db.ignoreEntry.findMany({
      where: { instanceId },
      orderBy: { ignoredAt: "desc" },
    }) as Promise<IgnoreEntry[]>;
  }

  async isIgnored(instanceId: number, mediaId: number, mediaType: MediaType): Promise<boolean> {
    const entry = await this.db.ignoreEntry.findUnique({
      where: { instanceId_mediaId_mediaType: { instanceId, mediaId, mediaType } },
    });
    return entry !== null;
  }

  async create(data: Omit<IgnoreEntry, "id" | "ignoredAt">): Promise<IgnoreEntry> {
    return this.db.ignoreEntry.create({ data }) as Promise<IgnoreEntry>;
  }

  async update(_id: number, _data: Partial<IgnoreEntry>): Promise<IgnoreEntry> {
    throw new Error("Ignore entries are immutable");
  }

  async delete(id: number): Promise<void> {
    await this.db.ignoreEntry.delete({ where: { id } });
  }
}

export const ignoreRepository = new IgnoreRepository();
