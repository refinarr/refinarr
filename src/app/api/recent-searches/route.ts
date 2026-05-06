import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { positiveInt } from "@/server/lib/api-errors";
import { logRepository } from "@/server/repositories/LogRepository";

const MAX_WINDOW_HOURS = 24;

export const GET = createApiHandler(async (req: NextRequest) => {
  const instanceId = positiveInt(
    req.nextUrl.searchParams.get("instanceId") ?? undefined,
    "instanceId",
  );
  const windowHoursRaw = Number(
    req.nextUrl.searchParams.get("windowHours") ?? "1",
  );
  const windowHours =
    Number.isFinite(windowHoursRaw) && windowHoursRaw > 0
      ? Math.min(windowHoursRaw, MAX_WINDOW_HOURS)
      : 1;
  const items = await logRepository.findRecentSearches(
    instanceId,
    windowHours * 60 * 60 * 1000,
  );
  return NextResponse.json({ items });
});
