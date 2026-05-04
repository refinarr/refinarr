import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/lib/db";
import {
  hashPassword,
  verifyPassword,
  getSession,
  SESSION_COOKIE,
} from "@/server/lib/auth";
import { passwordChangeSchema } from "@/shared/types/schemas";
import { checkRateLimit, clientIp } from "@/server/lib/rate-limit";
import { appLogger } from "@/server/lib/app-logger";
import { LogSource } from "@/server/lib/log-sources";

export async function POST(req: NextRequest) {
  const { allowed, retryAfterMs } = checkRateLimit(`pwchange:${clientIp(req)}`, {
    max: 10,
    windowMs: 15 * 60 * 1000,
  });
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many attempts" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } },
    );
  }

  // The session cookie is the only auth path that can change a password.
  // X-Api-Key callers and reverse-proxy users have no `currentPassword` to
  // verify against — they manage their auth elsewhere.
  const sessionId = req.cookies.get(SESSION_COOKIE)?.value;
  if (!sessionId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const session = await getSession(sessionId);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = passwordChangeSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid password" }, { status: 400 });
  const { currentPassword, newPassword } = parsed.data;

  if (currentPassword === newPassword) {
    return NextResponse.json({ error: "New password must differ from current" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!verifyPassword(currentPassword, user.passwordHash)) {
    appLogger.warn("Failed password change attempt", { source: LogSource.Auth, context: { userId: user.id } });
    return NextResponse.json({ error: "Wrong current password" }, { status: 401 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: hashPassword(newPassword) },
  });

  // Invalidate every OTHER session — keep the current one alive so the user
  // isn't bounced. Standard "log out other devices" behaviour.
  await prisma.session.deleteMany({
    where: { userId: user.id, id: { not: sessionId } },
  });
  appLogger.info("Password changed", { source: LogSource.Auth, context: { userId: user.id } });
  return NextResponse.json({ ok: true });
}
