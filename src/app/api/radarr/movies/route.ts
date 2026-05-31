import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import {
  assertArrType,
  boundedPositiveInt,
  notFound,
  positiveInt,
} from "@/server/lib/api-errors";
import { parseMediaQuery } from "@/server/lib/parse-media-query";
import { movieService } from "@/server/arr/composition";
import { instanceRepository } from "@/server/repositories/InstanceRepository";

const MAX_MEDIA_PAGE_SIZE = 250;

export const GET = createApiHandler(async (req: NextRequest) => {
  const s = req.nextUrl.searchParams;
  const instanceId = positiveInt(
    s.get("instanceId") ?? undefined,
    "instanceId",
  );
  const page = positiveInt(s.get("page") ?? "1", "page");
  const limit = boundedPositiveInt(
    s.get("limit") ?? "50",
    "limit",
    MAX_MEDIA_PAGE_SIZE,
  );

  const instance = await instanceRepository.findById(instanceId);
  if (!instance) throw notFound("Instance not found");
  assertArrType(instance, "radarr");

  const { items, total } = await movieService.getMovies(instanceId, {
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
