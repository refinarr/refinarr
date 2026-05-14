import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { positiveInt } from "@/server/lib/api-errors";
import { appLogRepository } from "@/server/repositories/AppLogRepository";
import type { LogLevel } from "@/shared/types/models";

const LOG_LEVELS: readonly LogLevel[] = ["debug", "info", "warn", "error"];

export const GET = createApiHandler(async (req: NextRequest) => {
  const s = req.nextUrl.searchParams;
  const level = s.get("level");
  const q = s.get("q") ?? undefined;
  const source = s.get("source") ?? undefined;
  const instanceIdRaw = s.get("instanceId");
  const instanceId =
    instanceIdRaw === null
      ? undefined
      : positiveInt(instanceIdRaw, "instanceId");
  const page = positiveInt(s.get("page") ?? "1", "page");
  const limit = positiveInt(s.get("limit") ?? "50", "limit");

  const filter = {
    level: LOG_LEVELS.includes(level as LogLevel)
      ? (level as LogLevel)
      : undefined,
    q,
    source,
    instanceId,
  };

  const { items, total } = await appLogRepository.findPaginated(
    filter,
    page,
    limit,
  );
  return NextResponse.json({
    items,
    total,
    page,
    limit,
    hasMore: page * limit < total,
  });
});

export const DELETE = createApiHandler(async () => {
  await appLogRepository.clearAll();
  return NextResponse.json({ ok: true });
});
