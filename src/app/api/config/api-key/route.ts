import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createApiHandler } from "@/server/lib/handler";
import { configRepository } from "@/server/repositories/ConfigRepository";
import { ConfigKey } from "@/server/config/keys";
import { verifySessionPassword, SESSION_COOKIE } from "@/server/lib/auth";
import { checkRateLimit, clientIp } from "@/server/lib/rate-limit";
import { apiKeyReauthSchema } from "@/shared/types/schemas";
import {
  badRequest,
  internal,
  parseJson,
  tooManyRequests,
  unauthorized,
} from "@/server/lib/api-errors";

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

  const sid = req.cookies.get(SESSION_COOKIE)?.value;
  const auth = await verifySessionPassword(sid, password);
  if (auth === "session_required")
    throw unauthorized(
      "API key re-auth requires a local session",
      "SESSION_REQUIRED",
    );
  if (auth === "invalid_password")
    throw unauthorized("Invalid password", "WRONG_PASSWORD");

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
