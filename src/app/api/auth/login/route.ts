import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/lib/db";
import {
  verifyPassword,
  createSession,
  SESSION_COOKIE,
} from "@/server/lib/auth";
import { checkRateLimit, clientIp } from "@/server/lib/rate-limit";
import { appLogger } from "@/server/lib/app-logger";
import { createApiHandler } from "@/server/lib/handler";
import {
  parseJson,
  tooManyRequests,
  unauthorized,
} from "@/server/lib/api-errors";
import { LogSource } from "@/shared/types/models";
import { credentialsSchema } from "@/shared/types/schemas";

export const POST = createApiHandler(async (req: NextRequest) => {
  const { allowed, retryAfterMs } = checkRateLimit(`login:${clientIp(req)}`, {
    max: 10,
    windowMs: 15 * 60 * 1000,
  });
  if (!allowed) {
    throw tooManyRequests("Too many attempts", retryAfterMs);
  }

  const { username, password } = await parseJson(
    req,
    credentialsSchema,
    "Invalid credentials",
  );
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !verifyPassword(password, user.passwordHash)) {
    const usernameHash = createHash("sha256")
      .update(username)
      .digest("hex")
      .slice(0, 8);
    appLogger.warn("Failed login attempt", {
      source: LogSource.Auth,
      context: { usernameHash },
    });
    throw unauthorized("Invalid credentials");
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
});
