import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { assertArrType, notFound, positiveInt } from "@/server/lib/api-errors";
import { instanceRepository } from "@/server/repositories/InstanceRepository";
import { movieService } from "@/server/arr/composition";

// Interactive search — live indexer query for a movie's candidate
// releases. No cache-control: releases are volatile (seeders/availability
// change minute-to-minute) and the *arr also caches the decision so the
// follow-up grab can re-resolve the chosen release.
export const GET = createApiHandler(async (req: NextRequest) => {
  const sp = req.nextUrl.searchParams;
  const instanceId = positiveInt(
    sp.get("instanceId") ?? undefined,
    "instanceId",
  );
  const movieId = positiveInt(sp.get("movieId") ?? undefined, "movieId");
  const instance = await instanceRepository.findById(instanceId);
  if (!instance) throw notFound("Instance not found");
  assertArrType(instance, "radarr");
  const releases = await movieService.getReleases(instanceId, movieId);
  return NextResponse.json(releases);
});
