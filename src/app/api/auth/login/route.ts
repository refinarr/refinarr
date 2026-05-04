import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { prisma } from "@/server/lib/db";
import { verifyPassword, createSession, SESSION_COOKIE } from "@/server/lib/auth";
import { credentialsSchema } from "@/shared/types/schemas";
import { checkRateLimit, clientIp } from "@/server/lib/rate-limit";
import { appLogger } from "@/server/lib/app-logger";
import { LogSource } from "@/server/lib/log-sources";

export async function POST(req: NextRequest) {
  const { allowed, retryAfterMs } = checkRateLimit(`login:${clientIp(req)}`, { max: 10, windowMs: 15 * 60 * 1000 });
  if (!allowed) {
    return NextResponse.json({ error: "Too many attempts" }, { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } });
  }

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = credentialsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 400 });
  }

  const { username, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !verifyPassword(password, user.passwordHash)) {
    const usernameHash = createHash("sha256").update(username).digest("hex").slice(0, 8);
    appLogger.warn("Failed login attempt", { source: LogSource.Auth, context: { usernameHash } });
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const session = await createSession(user.id);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, session.id, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: session.expiresAt,
  });
  return res;
}
