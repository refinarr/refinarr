import { NextRequest, NextResponse } from "next/server";
import { CronExpressionParser } from "cron-parser";
import { badRequest } from "@/server/lib/api-errors";
import { createApiHandler } from "@/server/lib/handler";
import type { CronPreviewResponse } from "@/shared/types/api";

export const GET = createApiHandler(async (req: NextRequest) => {
  const expr = req.nextUrl.searchParams.get("expr") ?? "";
  const fields = expr.trim().split(/\s+/);
  if (fields.length !== 5)
    throw badRequest("Invalid cron expression", "INVALID_CRON");

  try {
    const interval = CronExpressionParser.parse(expr, {
      currentDate: new Date(),
    });
    const next: string[] = [];
    for (let i = 0; i < 3; i++) {
      next.push(interval.next().toDate().toISOString());
    }
    const response: CronPreviewResponse = { next };
    return NextResponse.json(response);
  } catch {
    throw badRequest("Invalid cron expression", "INVALID_CRON");
  }
});
