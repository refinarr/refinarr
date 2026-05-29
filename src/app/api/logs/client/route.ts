import { NextRequest, NextResponse } from "next/server";
import { parseJson, tooManyRequests } from "@/server/lib/api-errors";
import { appLogger } from "@/server/lib/app-logger";
import { createApiHandler } from "@/server/lib/handler";
import { checkRateLimit, clientIp } from "@/server/lib/rate-limit";
import { redactString } from "@/server/lib/redact";
import { LogSource } from "@/shared/types/models";
import { clientErrorReportSchema } from "@/shared/types/schemas";

export const POST = createApiHandler(async (req: NextRequest) => {
  const { allowed, retryAfterMs } = checkRateLimit(
    `client-log:${clientIp(req)}`,
    {
      max: 30,
      windowMs: 60 * 1000,
    },
  );
  if (!allowed) {
    throw tooManyRequests("Too many client error reports", retryAfterMs);
  }

  const report = await parseJson(
    req,
    clientErrorReportSchema,
    "Invalid client error report",
  );
  const context = {
    path: report.path,
    method: report.method,
    status: report.status,
    code: report.code,
    traceId: report.traceId,
    component: report.component,
    stack: report.stack,
  };

  const message = redactString(report.message);
  if (
    report.status === undefined ||
    report.status === 0 ||
    report.status >= 500
  ) {
    appLogger.error(message, { source: LogSource.Client, context });
  } else {
    appLogger.warn(message, { source: LogSource.Client, context });
  }

  return NextResponse.json({ ok: true });
});
