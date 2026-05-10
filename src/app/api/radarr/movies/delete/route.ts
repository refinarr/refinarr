import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { parseJson } from "@/server/lib/api-errors";
import { movieService } from "@/server/services/MovieService";
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
      action: "movie",
      instanceId,
      mediaId,
      title,
      groupId,
    });
  }
  dataCache.invalidate(instanceId);
  return NextResponse.json(result);
});
