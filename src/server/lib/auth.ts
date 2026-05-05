import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { prisma } from "./db";

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const HASH_LEN = 64;
const SESSION_DAYS = 30;
const SESSION_MS = SESSION_DAYS * 24 * 60 * 60 * 1000;

export const SESSION_COOKIE = "rfn_session";

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, HASH_LEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
  return `scrypt$${SCRYPT_N}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "scrypt") return false;
  const N = Number(parts[1]);
  const salt = Buffer.from(parts[2], "hex");
  const expected = Buffer.from(parts[3], "hex");
  if (!Number.isInteger(N) || N <= 0 || expected.length !== HASH_LEN) return false;
  let actual: Buffer;
  try {
    actual = scryptSync(password, salt, HASH_LEN, { N, r: SCRYPT_R, p: SCRYPT_P });
  } catch {
    return false;
  }
  return timingSafeEqual(actual, expected);
}

export function constantTimeEquals(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export async function getUserCount(): Promise<number> {
  return prisma.user.count();
}

export async function createSession(userId: number): Promise<{ id: string; expiresAt: Date }> {
  const id = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_MS);
  await prisma.session.create({ data: { id, userId, expiresAt } });
  return { id, expiresAt };
}

export async function getSession(id: string): Promise<{ userId: number; expiresAt: Date } | null> {
  const s = await prisma.session.findUnique({ where: { id } });
  if (!s) return null;
  if (s.expiresAt.getTime() < Date.now()) {
    await prisma.session.delete({ where: { id } }).catch(() => {});
    return null;
  }
  return { userId: s.userId, expiresAt: s.expiresAt };
}

export async function isValidSession(id: string): Promise<boolean> {
  return (await getSession(id)) !== null;
}

export async function deleteSession(id: string): Promise<void> {
  await prisma.session.delete({ where: { id } }).catch(() => {});
}

export async function pruneExpiredSessions(): Promise<void> {
  await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
}

export type SessionPasswordResult = "ok" | "session_required" | "invalid_password";

// Verifies the caller holds an active session AND knows the account password.
// Used by /api/config/api-key to gate reveal/rotate behind re-auth.
export async function verifySessionPassword(
  sid: string | undefined,
  password: string,
): Promise<SessionPasswordResult> {
  if (!sid) return "session_required";
  const session = await getSession(sid);
  if (!session) return "session_required";
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) return "session_required";
  return verifyPassword(password, user.passwordHash) ? "ok" : "invalid_password";
}
