import { PrismaClient } from "@prisma/client";
import { prisma } from "@/server/lib/db";

export abstract class BaseRepository<T> {
  protected readonly db: PrismaClient = prisma;

  abstract findById(id: number): Promise<T | null>;
  abstract findAll(): Promise<T[]>;
  abstract create(data: Omit<T, "id" | "createdAt">): Promise<T>;
  abstract update(id: number, data: Partial<T>): Promise<T>;
  abstract delete(id: number): Promise<void>;
}
