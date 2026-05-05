import { describe, test, expect } from "vitest";
import {
  hashPassword,
  verifyPassword,
  verifySessionPassword,
  constantTimeEquals,
  getUserCount,
  createSession,
  getSession,
  isValidSession,
  deleteSession,
  pruneExpiredSessions,
} from "@/server/lib/auth";
import { prisma } from "@/server/lib/db";

describe("hashPassword / verifyPassword", () => {
  test("correct password verifies against its own hash", () => {
    const hash = hashPassword("correct-password-long");
    expect(verifyPassword("correct-password-long", hash)).toBe(true);
  });

  test("wrong password does not verify", () => {
    const hash = hashPassword("correct-password-long");
    expect(verifyPassword("wrong-password-xxxxxx", hash)).toBe(false);
  });

  test("two hashes of the same password are different (random salt)", () => {
    const a = hashPassword("same-password-here1");
    const b = hashPassword("same-password-here1");
    expect(a).not.toBe(b);
  });

  test("hash starts with scrypt$ prefix", () => {
    expect(hashPassword("somepassword123")).toMatch(/^scrypt\$/);
  });
});

describe("verifyPassword — malformed stored hash", () => {
  test("wrong prefix returns false", () => {
    expect(verifyPassword("pw", "notscrypt$16384$aabb$aabb")).toBe(false);
  });

  test("too few segments returns false", () => {
    expect(verifyPassword("pw", "scrypt$16384$aabb")).toBe(false);
  });

  test("too many segments returns false", () => {
    expect(verifyPassword("pw", "scrypt$16384$aabb$ccdd$extra")).toBe(false);
  });

  test("non-integer N returns false", () => {
    expect(verifyPassword("pw", "scrypt$abc$aabb$ccdd")).toBe(false);
  });

  test("N === 0 returns false", () => {
    expect(verifyPassword("pw", "scrypt$0$" + "aa".repeat(16) + "$" + "bb".repeat(64))).toBe(false);
  });

  test("N < 0 returns false", () => {
    expect(verifyPassword("pw", "scrypt$-1$" + "aa".repeat(16) + "$" + "bb".repeat(64))).toBe(false);
  });

  test("hash part wrong length returns false", () => {
    expect(verifyPassword("pw", "scrypt$16384$" + "aa".repeat(16) + "$" + "bb".repeat(32))).toBe(false);
  });

  test("empty hash part returns false", () => {
    expect(verifyPassword("pw", "scrypt$16384$" + "aa".repeat(16) + "$")).toBe(false);
  });
});

describe("constantTimeEquals", () => {
  test("equal strings return true", () => {
    expect(constantTimeEquals("hello", "hello")).toBe(true);
  });

  test("one character different returns false", () => {
    expect(constantTimeEquals("hello", "hellx")).toBe(false);
  });

  test("different lengths return false", () => {
    expect(constantTimeEquals("short", "longer-string")).toBe(false);
  });

  test("empty strings are equal", () => {
    expect(constantTimeEquals("", "")).toBe(true);
  });

  test("empty vs non-empty returns false", () => {
    expect(constantTimeEquals("", "a")).toBe(false);
  });

  test("unicode strings with same bytes are equal", () => {
    expect(constantTimeEquals("café", "café")).toBe(true);
  });
});

describe("getUserCount", () => {
  test("returns 0 with no users", async () => {
    expect(await getUserCount()).toBe(0);
  });

  test("returns the row count after inserts", async () => {
    await prisma.user.createMany({
      data: [
        { username: "u1", passwordHash: "x" },
        { username: "u2", passwordHash: "x" },
      ],
    });
    expect(await getUserCount()).toBe(2);
  });
});

describe("session lifecycle", () => {
  async function makeUser() {
    return prisma.user.create({ data: { username: "sess-user", passwordHash: "x" } });
  }

  test("createSession persists a 32-byte hex token with future expiresAt", async () => {
    const user = await makeUser();
    const before = Date.now();
    const { id, expiresAt } = await createSession(user.id);
    expect(id).toMatch(/^[a-f0-9]{64}$/);
    expect(expiresAt.getTime()).toBeGreaterThan(before);
  });

  test("getSession returns userId for a valid session", async () => {
    const user = await makeUser();
    const { id } = await createSession(user.id);
    const s = await getSession(id);
    expect(s?.userId).toBe(user.id);
  });

  test("getSession returns null for unknown id", async () => {
    expect(await getSession("does-not-exist")).toBeNull();
  });

  test("getSession deletes and returns null for an expired session", async () => {
    const user = await makeUser();
    await prisma.session.create({
      data: { id: "expired-id", userId: user.id, expiresAt: new Date(Date.now() - 1000) },
    });
    expect(await getSession("expired-id")).toBeNull();
    expect(await prisma.session.findUnique({ where: { id: "expired-id" } })).toBeNull();
  });

  test("isValidSession is true for active and false for missing", async () => {
    const user = await makeUser();
    const { id } = await createSession(user.id);
    expect(await isValidSession(id)).toBe(true);
    expect(await isValidSession("missing")).toBe(false);
  });

  test("deleteSession removes the row and is idempotent on missing ids", async () => {
    const user = await makeUser();
    const { id } = await createSession(user.id);
    await deleteSession(id);
    expect(await prisma.session.findUnique({ where: { id } })).toBeNull();
    // Second call should not throw.
    await deleteSession(id);
  });

  test("pruneExpiredSessions only removes expired rows", async () => {
    const user = await makeUser();
    await prisma.session.createMany({
      data: [
        { id: "ok", userId: user.id, expiresAt: new Date(Date.now() + 60_000) },
        { id: "old", userId: user.id, expiresAt: new Date(Date.now() - 60_000) },
      ],
    });
    await pruneExpiredSessions();
    expect(await prisma.session.findUnique({ where: { id: "ok" } })).not.toBeNull();
    expect(await prisma.session.findUnique({ where: { id: "old" } })).toBeNull();
  });
});

describe("verifySessionPassword", () => {
  test("returns session_required when sid is undefined", async () => {
    expect(await verifySessionPassword(undefined, "any-password")).toBe("session_required");
  });

  test("returns session_required for an unknown sid", async () => {
    expect(await verifySessionPassword("does-not-exist", "any-password")).toBe(
      "session_required",
    );
  });

  test("returns session_required when the session points at a deleted user", async () => {
    const user = await prisma.user.create({
      data: { username: "orphan", passwordHash: hashPassword("password-1234") },
    });
    const { id } = await createSession(user.id);
    await prisma.user.delete({ where: { id: user.id } });
    expect(await verifySessionPassword(id, "password-1234")).toBe("session_required");
  });

  test("returns invalid_password when the session is valid but the password is wrong", async () => {
    const user = await prisma.user.create({
      data: { username: "auth-user", passwordHash: hashPassword("right-password-1") },
    });
    const { id } = await createSession(user.id);
    expect(await verifySessionPassword(id, "wrong-password-1")).toBe("invalid_password");
  });

  test("returns ok when the session and password both match", async () => {
    const user = await prisma.user.create({
      data: { username: "ok-user", passwordHash: hashPassword("right-password-2") },
    });
    const { id } = await createSession(user.id);
    expect(await verifySessionPassword(id, "right-password-2")).toBe("ok");
  });
});
