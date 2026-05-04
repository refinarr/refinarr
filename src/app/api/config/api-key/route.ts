import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createApiHandler } from "@/server/lib/handler";
import { configRepository } from "@/server/repositories/ConfigRepository";
import { ConfigKey } from "@/server/config/keys";
import { prisma } from "@/server/lib/db";
import { verifyPassword, getSession, SESSION_COOKIE } from "@/server/lib/auth";
import { checkRateLimit, clientIp } from "@/server/lib/rate-limit";
import { z } from "zod";

/**
 * The X-Api-Key for scripted access. Reading or rotating it requires the
 * caller's password (re-auth) on top of an active session. We never return
 * this value through any other endpoint — it's a one-step-removed secret.
 */

const reauthSchema = z.object({ password: z.string().min(1).max(256) });

async function authenticatedUserPassword(req: NextRequest, pw: string): Promise<boolean> {
  const sid = req.cookies.get(SESSION_COOKIE)?.value;
  if (!sid) return false;
  const session = await getSession(sid);
  if (!session) return false;
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) return false;
  return verifyPassword(pw, user.passwordHash);
}

export const POST = createApiHandler(async (req: NextRequest) => {
  // Rate-limit re-auth attempts.
  const { allowed } = checkRateLimit(`apikey:${clientIp(req)}`, { max: 10, windowMs: 15 * 60 * 1000 });
  if (!allowed) return NextResponse.json({ error: "Too many attempts" }, { status: 429 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = reauthSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Password required" }, { status: 400 });

  // If in reverse-proxy trust mode, the user has no password here. Fall back
  // to allowing the read because the upstream proxy already authenticated.
  const proxyMode = process.env.TRUST_PROXY_AUTH === "true"
    && req.headers.get(process.env.PROXY_USER_HEADER ?? "X-Remote-User");
  if (!proxyMode) {
    const ok = await authenticatedUserPassword(req, parsed.data.password);
    if (!ok) return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const action = req.nextUrl.searchParams.get("action");
  if (action === "rotate") {
    const next = crypto.randomBytes(16).toString("hex");
    await configRepository.setTyped(ConfigKey.ApiKey, next);
    return NextResponse.json({ apiKey: next });
  }

  const apiKey = await configRepository.getTyped(ConfigKey.ApiKey);
  if (!apiKey) return NextResponse.json({ error: "API key not initialized" }, { status: 500 });
  return NextResponse.json({ apiKey });
});
