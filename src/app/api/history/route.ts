import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { logRepository } from "@/server/repositories/LogRepository";
import type { ActionStatus, ActionType } from "@/shared/types/models";

export const GET = createApiHandler(async (req: NextRequest) => {
  const s = req.nextUrl.searchParams;
  const instanceId = s.has("instanceId")
    ? Number(s.get("instanceId"))
    : undefined;
  const status = (s.get("status") ?? undefined) as ActionStatus | undefined;
  const action = (s.get("action") ?? undefined) as ActionType | undefined;
  const page = Number(s.get("page") ?? "1");
  const limit = Number(s.get("limit") ?? "50");

  const { items, total } = await logRepository.findPaginated(
    { instanceId, status, action },
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
  await logRepository.clearAll();
  return NextResponse.json({ ok: true });
});
