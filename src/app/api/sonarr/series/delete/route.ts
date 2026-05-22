import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { assertArrType, notFound, parseJson } from "@/server/lib/api-errors";
import { seriesService } from "@/server/arr/composition";
import { instanceRepository } from "@/server/repositories/InstanceRepository";
import { dataCache } from "@/server/lib/data-cache";
import { sonarrDeleteSchema } from "@/shared/types/schemas";

export const POST = createApiHandler(async (req: NextRequest) => {
  const { instanceId, mediaId, fileIds, title, groupId } = await parseJson(
    req,
    sonarrDeleteSchema,
    "Invalid delete payload",
  );
  const instance = await instanceRepository.findById(instanceId);
  if (!instance) throw notFound("Instance not found");
  assertArrType(instance, "sonarr");

  const result = await seriesService.deleteFiles(
    instanceId,
    mediaId,
    fileIds,
    title,
    { groupId },
  );
  dataCache.invalidate(instanceId);
  return NextResponse.json(result);
});
