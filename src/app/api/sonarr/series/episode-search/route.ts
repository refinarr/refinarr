import type { NextRequest } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { assertArrType, notFound, parseJson } from "@/server/lib/api-errors";
import { respondToSearchDispatch } from "@/server/lib/search-dispatch-response";
import { instanceRepository } from "@/server/repositories/InstanceRepository";
import { searchDispatcher } from "@/server/services/SearchDispatcher";
import { sonarrEpisodeSearchSchema } from "@/shared/types/schemas";

export const POST = createApiHandler(async (req: NextRequest) => {
  const { instanceId, mediaId, fileId, title, groupId } = await parseJson(
    req,
    sonarrEpisodeSearchSchema,
    "Invalid search payload",
  );
  const instance = await instanceRepository.findById(instanceId);
  if (!instance) throw notFound("Instance not found");
  assertArrType(instance, "sonarr");
  return respondToSearchDispatch(
    await searchDispatcher.dispatch({
      instance,
      action: "episode",
      mediaId,
      fileId,
      title,
      groupId,
    }),
  );
});
