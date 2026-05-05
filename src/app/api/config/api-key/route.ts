import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createApiHandler } from "@/server/lib/handler";
import { configRepository } from "@/server/repositories/ConfigRepository";
import { ConfigKey } from "@/server/config/keys";
import { prisma } from "@/server/lib/db";
import { verifyPassword, getSession, SESSION_COOKIE } from "@/server/lib/auth";
import { checkRateLimit, clientIp } from "@/server/lib/rate-limit";
import { apiKeyReauthSchema } from "@/shared/types/schemas";
import {
  badRequest,
  internal,
  parseJson,
  tooManyRequests,
  unauthorized,
} from "@/server/lib/api-errors";

/**
 * The X-Api-Key for scripted access. Reading or rotating it requires the
 * caller's password (re-auth) on top of an active session. We never return
 * this value through any other endpoint — it's a one-step-removed secret.
 */

async function authenticatedUserPassword(
  req: NextRequest,
  pw: string,
): Promise<boolean> {
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
  const { allowed, retryAfterMs } = checkRateLimit(`apikey:${clientIp(req)}`, {
    max: 10,
    windowMs: 15 * 60 * 1000,
  });
  if (!allowed)
    throw tooManyRequests("Too many attempts", retryAfterMs, "RATE_LIMITED");

  const { password } = await parseJson(
    req,
    apiKeyReauthSchema,
    "Password required",
  );

  const ok = await authenticatedUserPassword(req, password);
  if (!ok) throw unauthorized("Invalid password", "WRONG_PASSWORD");

  const action = req.nextUrl.searchParams.get("action");
  if (action !== null && action !== "rotate") {
    throw badRequest("Invalid action");
  }
  if (action === "rotate") {
    const next = crypto.randomBytes(16).toString("hex");
    await configRepository.setTyped(ConfigKey.ApiKey, next);
    return NextResponse.json({ apiKey: next });
  }

  const apiKey = await configRepository.getTyped(ConfigKey.ApiKey);
  if (!apiKey) throw internal("API key not initialized");
  return NextResponse.json({ apiKey });
});
