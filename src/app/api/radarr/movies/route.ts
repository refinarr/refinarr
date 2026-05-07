import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { parseMediaQuery } from "@/server/lib/parse-media-query";
import { movieService } from "@/server/services/MovieService";

export const GET = createApiHandler(async (req: NextRequest) => {
  const s = req.nextUrl.searchParams;
  const instanceId = Number(s.get("instanceId"));
  const page = Number(s.get("page") ?? "1");
  const limit = Number(s.get("limit") ?? "50");

  const { items, total } = await movieService.getFlaggedMovies(instanceId, {
    page,
    limit,
    ...parseMediaQuery(s),
  });

  return NextResponse.json({
    items,
    total,
    page,
    limit,
    hasMore: page * limit < total,
  });
});
