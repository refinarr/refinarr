import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { assertArrType, notFound, parseJson } from "@/server/lib/api-errors";
import { seriesService } from "@/server/arr/composition";
import { instanceRepository } from "@/server/repositories/InstanceRepository";
import { dataCache } from "@/server/lib/data-cache";
import { sonarrGrabSchema } from "@/shared/types/schemas";

// Force-grab a season-pack release picked from interactive search.
// Synchronous (not queued), via the typed service singleton.
export const POST = createApiHandler(async (req: NextRequest) => {
  const { instanceId, mediaId, guid, indexerId, title, groupId } =
    await parseJson(req, sonarrGrabSchema, "Invalid grab payload");
  const instance = await instanceRepository.findById(instanceId);
  if (!instance) throw notFound("Instance not found");
  assertArrType(instance, "sonarr");

  const result = await seriesService.grabSeasonRelease(
    instanceId,
    mediaId,
    { guid, indexerId },
    title,
    { groupId },
  );
  dataCache.invalidate(instanceId);
  return NextResponse.json(result);
});
