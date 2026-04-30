import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { seriesService } from "@/server/services/SeriesService";

export const GET = createApiHandler(async (req: NextRequest) => {
  const s = req.nextUrl.searchParams;
  const instanceId = Number(s.get("instanceId"));
  const page = Number(s.get("page") ?? "1");
  const limit = Number(s.get("limit") ?? "50");
  const sortBy = (s.get("sortBy") ?? "score") as "score" | "title" | "added";
  const order = (s.get("order") ?? "asc") as "asc" | "desc";
  const maxScore = s.has("maxScore") ? Number(s.get("maxScore")) : undefined;

  const { items, total } = await seriesService.getFlaggedSeries(instanceId, {
    page,
    limit,
    sortBy,
    order,
    maxScore,
  });

  return NextResponse.json({
    items,
    total,
    page,
    limit,
    hasMore: page * limit < total,
  });
});
