import type { User } from "@prisma/client";
import { BaseRepository } from "./BaseRepository";

export class UserRepository extends BaseRepository<User> {
  async findById(id: number): Promise<User | null> {
    return this.db.user.findUnique({ where: { id } });
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.db.user.findUnique({ where: { username } });
  }

  async findAll(): Promise<User[]> {
    return this.db.user.findMany();
  }

  async count(): Promise<number> {
    return this.db.user.count();
  }

  async create(data: Omit<User, "id" | "createdAt">): Promise<User> {
    return this.db.user.create({ data });
  }

  async update(id: number, data: Partial<User>): Promise<User> {
    return this.db.user.update({ where: { id }, data });
  }

  async delete(id: number): Promise<void> {
    await this.db.user.delete({ where: { id } });
  }

  // Atomic: password change and stale-session purge succeed or fail
  // together, so a DB hiccup mid-flow can't leave other devices logged
  // in after a successful password change.
  async rotatePasswordAndRevokeOtherSessions(
    userId: number,
    newPasswordHash: string,
    keepSessionToken: string,
  ): Promise<void> {
    await this.db.$transaction([
      this.db.user.update({
        where: { id: userId },
        data: { passwordHash: newPasswordHash },
      }),
      this.db.session.deleteMany({
        where: { userId, id: { not: keepSessionToken } },
      }),
    ]);
  }
}

export const userRepository = new UserRepository();
