import type { Session } from "@prisma/client";
import { BaseRepository } from "./BaseRepository";

// `id` is a hex token (string), so the base number-keyed methods are
// stubbed; real lookups go through `findByToken`.
class SessionRepository extends BaseRepository<Session> {
  async findById(_id: number): Promise<Session | null> {
    return null;
  }

  async findAll(): Promise<Session[]> {
    return this.db.session.findMany();
  }

  async findByToken(token: string): Promise<Session | null> {
    return this.db.session.findUnique({ where: { id: token } });
  }

  async create(data: Omit<Session, "createdAt">): Promise<Session> {
    return this.db.session.create({ data });
  }

  async update(_id: number, _data: Partial<Session>): Promise<Session> {
    throw new Error("Sessions are immutable; create a new session instead");
  }

  async delete(_id: number): Promise<void> {
    throw new Error("Use deleteByToken(token) instead");
  }

  // Safe to call with an unknown token — deleteMany returns { count: 0 }
  // instead of throwing P2025, preserving the "no-op if missing"
  // contract while letting real DB errors propagate.
  async deleteByToken(token: string): Promise<void> {
    await this.db.session.deleteMany({ where: { id: token } });
  }

  async deleteAllForUser(userId: number): Promise<number> {
    const result = await this.db.session.deleteMany({ where: { userId } });
    return result.count;
  }

  async deleteOtherSessionsForUser(
    userId: number,
    exceptToken: string,
  ): Promise<number> {
    const result = await this.db.session.deleteMany({
      where: { userId, id: { not: exceptToken } },
    });
    return result.count;
  }

  async pruneExpired(): Promise<number> {
    const result = await this.db.session.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return result.count;
  }
}

export const sessionRepository = new SessionRepository();
