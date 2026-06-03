import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import {
  assertArrType,
  nonNegativeInt,
  notFound,
  positiveInt,
} from "@/server/lib/api-errors";
import { instanceRepository } from "@/server/repositories/InstanceRepository";
import { seriesService } from "@/server/arr/composition";

// Interactive season-pack search — live indexer query for one season's
// candidate releases. seasonNumber 0 (Specials) is valid → nonNegativeInt.
// No cache-control (volatile).
export const GET = createApiHandler(async (req: NextRequest) => {
  const sp = req.nextUrl.searchParams;
  const instanceId = positiveInt(
    sp.get("instanceId") ?? undefined,
    "instanceId",
  );
  const seriesId = positiveInt(sp.get("seriesId") ?? undefined, "seriesId");
  const seasonNumber = nonNegativeInt(
    sp.get("seasonNumber") ?? undefined,
    "seasonNumber",
  );
  const instance = await instanceRepository.findById(instanceId);
  if (!instance) throw notFound("Instance not found");
  assertArrType(instance, "sonarr");
  const releases = await seriesService.getSeasonReleases(
    instanceId,
    seriesId,
    seasonNumber,
  );
  return NextResponse.json(releases);
});
