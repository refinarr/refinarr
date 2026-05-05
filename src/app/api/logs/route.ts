import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { appLogRepository } from "@/server/repositories/AppLogRepository";
import type { LogLevel } from "@/shared/types/models";

const LOG_LEVELS: readonly LogLevel[] = ["debug", "info", "warn", "error"];

export const GET = createApiHandler(async (req: NextRequest) => {
  const s = req.nextUrl.searchParams;
  const level = s.get("level");
  const q = s.get("q") ?? undefined;
  const page = Number(s.get("page") ?? "1");
  const limit = Number(s.get("limit") ?? "50");

  const filter = {
    level: LOG_LEVELS.includes(level as LogLevel)
      ? (level as LogLevel)
      : undefined,
    q,
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
