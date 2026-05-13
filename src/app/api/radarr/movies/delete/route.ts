import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { assertArrType, notFound, parseJson } from "@/server/lib/api-errors";
import { movieService } from "@/server/arr/composition";
import { instanceRepository } from "@/server/repositories/InstanceRepository";
import { searchDispatcher } from "@/server/services/SearchDispatcher";
import { dataCache } from "@/server/lib/data-cache";
import { radarrDeleteSchema } from "@/shared/types/schemas";

export const POST = createApiHandler(async (req: NextRequest) => {
  const {
    instanceId,
    mediaId,
    fileId,
    title,
    search = false,
    groupId,
  } = await parseJson(req, radarrDeleteSchema, "Invalid delete payload");
  const instance = await instanceRepository.findById(instanceId);
  if (!instance) throw notFound("Instance not found");
  assertArrType(instance, "radarr");

  const result = await movieService.deleteFile(
    instanceId,
    mediaId,
    fileId,
    title,
    false,
    { groupId },
  );
  if (search && result.status !== "failed") {
    await searchDispatcher.dispatch({
      instance,
      action: "movie",
      mediaId,
      title,
      groupId,
    });
  }
  dataCache.invalidate(instanceId);
  return NextResponse.json(result);
});
