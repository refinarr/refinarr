import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/lib/db";
import { hashPassword, createSession, getUserCount, SESSION_COOKIE } from "@/server/lib/auth";
import { credentialsSchema } from "@/shared/types/schemas";
import { checkRateLimit, clientIp } from "@/server/lib/rate-limit";
import { appLogger } from "@/server/lib/app-logger";
import { LogSource } from "@/server/lib/log-sources";

export async function POST(req: NextRequest) {
  const { allowed, retryAfterMs } = checkRateLimit(`setup:${clientIp(req)}`, { max: 10, windowMs: 15 * 60 * 1000 });
  if (!allowed) {
    return NextResponse.json({ error: "Too many attempts" }, { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } });
  }

  // First-run only: refuse if any user exists.
  if ((await getUserCount()) > 0) {
    return NextResponse.json({ error: "Setup already completed" }, { status: 409 });
  }

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = credentialsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid credentials format" }, { status: 400 });
  }

  const { username, password } = parsed.data;

  try {
    const user = await prisma.user.create({
      data: { username, passwordHash: hashPassword(password) },
    });
    const session = await createSession(user.id);
    appLogger.info("Initial admin user created", { source: LogSource.Auth, context: { username } });
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, session.id, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: session.expiresAt,
    });
    return res;
  } catch {
    return NextResponse.json({ error: "Couldn't create user" }, { status: 500 });
  }
}
