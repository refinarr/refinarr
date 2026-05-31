import { NextRequest, NextResponse } from "next/server";
import { createApiHandler, READ_CACHE } from "@/server/lib/handler";
import { assertArrType, notFound, positiveInt } from "@/server/lib/api-errors";
import { parseMediaQuery } from "@/server/lib/parse-media-query";
import { movieService } from "@/server/arr/composition";
import { instanceRepository } from "@/server/repositories/InstanceRepository";

export const GET = createApiHandler(
  async (req: NextRequest) => {
    const s = req.nextUrl.searchParams;
    const instanceId = positiveInt(
      s.get("instanceId") ?? undefined,
      "instanceId",
    );
    const page = positiveInt(s.get("page") ?? "1", "page");
    const limit = positiveInt(s.get("limit") ?? "50", "limit", 500);
    // Validate filter params up front so a malformed query fails with 400
    // before we touch the DB (otherwise a bad instanceId masks it as 404).
    const query = parseMediaQuery(s);

    const instance = await instanceRepository.findById(instanceId);
    if (!instance) throw notFound("Instance not found");
    assertArrType(instance, "radarr");

    const { items, total } = await movieService.getMovies(instanceId, {
      page,
      limit,
      ...query,
    });

    return NextResponse.json({
      items,
      total,
      page,
      limit,
      hasMore: page * limit < total,
    });
  },
  { cacheControl: READ_CACHE },
);
