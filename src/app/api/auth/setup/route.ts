import { NextRequest, NextResponse } from "next/server";
import { userRepository } from "@/server/repositories/UserRepository";
import {
  hashPassword,
  createSession,
  getUserCount,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/server/lib/auth";
import { checkRateLimit, clientIp } from "@/server/lib/rate-limit";
import { appLogger } from "@/server/lib/app-logger";
import {
  HttpError,
  conflict,
  parseJson,
  tooManyRequests,
} from "@/server/lib/api-errors";
import { createApiHandler } from "@/server/lib/handler";
import { LogSource } from "@/shared/types/models";
import { credentialsSchema } from "@/shared/types/schemas";

export const POST = createApiHandler(async (req: NextRequest) => {
  const { allowed, retryAfterMs } = checkRateLimit(`setup:${clientIp(req)}`, {
    max: 10,
    windowMs: 15 * 60 * 1000,
  });
  if (!allowed) {
    throw tooManyRequests("Too many attempts", retryAfterMs);
  }

  // First-run only: refuse if any user exists.
  if ((await getUserCount()) > 0) {
    throw conflict("Setup already completed");
  }

  const { username, password } = await parseJson(
    req,
    credentialsSchema,
    "Invalid credentials format",
  );

  try {
    const user = await userRepository.create({
      username,
      passwordHash: hashPassword(password),
    });
    const session = await createSession(user.id);
    appLogger.info("Initial admin user created", {
      source: LogSource.Auth,
      context: { username },
    });
    const res = NextResponse.json({ ok: true });
    res.cookies.set(
      SESSION_COOKIE,
      session.id,
      sessionCookieOptions(req, session.expiresAt),
    );
    return res;
  } catch {
    throw new HttpError({
      status: 500,
      message: "Couldn't create user",
      expose: true,
      logLevel: "error",
      context: { username },
    });
  }
});
