import { NextRequest, NextResponse } from "next/server";
import { userRepository } from "@/server/repositories/UserRepository";
import {
  hashPassword,
  verifyPassword,
  getSession,
  SESSION_COOKIE,
} from "@/server/lib/auth";
import { checkRateLimit, clientIp } from "@/server/lib/rate-limit";
import { appLogger } from "@/server/lib/app-logger";
import {
  badRequest,
  parseJson,
  tooManyRequests,
  unauthorized,
} from "@/server/lib/api-errors";
import { createApiHandler } from "@/server/lib/handler";
import { LogSource } from "@/shared/types/models";
import { passwordChangeSchema } from "@/shared/types/schemas";

export const POST = createApiHandler(async (req: NextRequest) => {
  const { allowed, retryAfterMs } = checkRateLimit(
    `pwchange:${clientIp(req)}`,
    {
      max: 10,
      windowMs: 15 * 60 * 1000,
    },
  );
  if (!allowed) {
    throw tooManyRequests("Too many attempts", retryAfterMs);
  }

  // The session cookie is the only auth path that can change a password.
  // X-Api-Key callers and reverse-proxy users have no `currentPassword` to
  // verify against — they manage their auth elsewhere.
  const sessionId = req.cookies.get(SESSION_COOKIE)?.value;
  if (!sessionId) throw unauthorized();
  const session = await getSession(sessionId);
  if (!session) throw unauthorized();

  const { currentPassword, newPassword } = await parseJson(
    req,
    passwordChangeSchema,
    "Invalid password",
  );

  if (currentPassword === newPassword) {
    throw badRequest(
      "New password must differ from current",
      "SAME_AS_CURRENT",
    );
  }

  const user = await userRepository.findById(session.userId);
  if (!user) throw unauthorized();
  if (!verifyPassword(currentPassword, user.passwordHash)) {
    appLogger.warn("Failed password change attempt", {
      source: LogSource.Auth,
      context: { userId: user.id },
    });
    throw unauthorized("Wrong current password");
  }

  await userRepository.rotatePasswordAndRevokeOtherSessions(
    user.id,
    hashPassword(newPassword),
    sessionId,
  );
  appLogger.info("Password changed", {
    source: LogSource.Auth,
    context: { userId: user.id },
  });
  return NextResponse.json({ ok: true });
});
