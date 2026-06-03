import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { assertArrType, notFound, parseJson } from "@/server/lib/api-errors";
import { movieService } from "@/server/arr/composition";
import { instanceRepository } from "@/server/repositories/InstanceRepository";
import { dataCache } from "@/server/lib/data-cache";
import { radarrGrabSchema } from "@/shared/types/schemas";

// Force-grab a specific release picked from interactive search. Synchronous
// (not queued) like delete — calls the typed service singleton directly.
export const POST = createApiHandler(async (req: NextRequest) => {
  const { instanceId, mediaId, guid, indexerId, title, groupId } =
    await parseJson(req, radarrGrabSchema, "Invalid grab payload");
  const instance = await instanceRepository.findById(instanceId);
  if (!instance) throw notFound("Instance not found");
  assertArrType(instance, "radarr");

  const result = await movieService.grabRelease(
    instanceId,
    mediaId,
    { guid, indexerId },
    title,
    { groupId },
  );
  dataCache.invalidate(instanceId);
  return NextResponse.json(result);
});
