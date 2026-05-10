import { NextRequest } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { parseJson } from "@/server/lib/api-errors";
import { respondToSearchDispatch } from "@/server/lib/search-dispatch-response";
import { searchDispatcher } from "@/server/services/SearchDispatcher";
import { sonarrSeasonSearchSchema } from "@/shared/types/schemas";

export const POST = createApiHandler(async (req: NextRequest) => {
  const { instanceId, mediaId, seasonNumber, title, groupId } = await parseJson(
    req,
    sonarrSeasonSearchSchema,
    "Invalid search payload",
  );
  return respondToSearchDispatch(
    await searchDispatcher.dispatch({
      action: "season",
      instanceId,
      mediaId,
      seasonNumber,
      title,
      groupId,
    }),
  );
});
