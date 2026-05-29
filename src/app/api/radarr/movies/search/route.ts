import type { NextRequest } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { assertArrType, notFound, parseJson } from "@/server/lib/api-errors";
import { respondToSearchDispatch } from "@/server/lib/search-dispatch-response";
import { instanceRepository } from "@/server/repositories/InstanceRepository";
import { searchDispatcher } from "@/server/services/SearchDispatcher";
import { radarrSearchSchema } from "@/shared/types/schemas";

export const POST = createApiHandler(async (req: NextRequest) => {
  const { instanceId, mediaId, title, groupId } = await parseJson(
    req,
    radarrSearchSchema,
    "Invalid search payload",
  );
  const instance = await instanceRepository.findById(instanceId);
  if (!instance) throw notFound("Instance not found");
  assertArrType(instance, "radarr");
  return respondToSearchDispatch(
    await searchDispatcher.dispatch({
      instance,
      action: "movie",
      mediaId,
      title,
      groupId,
    }),
  );
});
