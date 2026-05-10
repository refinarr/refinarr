import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { parseJson } from "@/server/lib/api-errors";
import { seriesService } from "@/server/services/SeriesService";
import { searchDispatcher } from "@/server/services/SearchDispatcher";
import { dataCache } from "@/server/lib/data-cache";
import { sonarrDeleteSchema } from "@/shared/types/schemas";

export const POST = createApiHandler(async (req: NextRequest) => {
  const {
    instanceId,
    mediaId,
    fileIds,
    title,
    search = false,
    groupId,
  } = await parseJson(req, sonarrDeleteSchema, "Invalid delete payload");

  const result = await seriesService.deleteFiles(
    instanceId,
    mediaId,
    fileIds,
    title,
    false,
    { groupId },
  );
  if (search && result.status !== "failed") {
    await searchDispatcher.dispatch({
      action: "series",
      instanceId,
      mediaId,
      title,
      groupId,
    });
  }
  dataCache.invalidate(instanceId);
  return NextResponse.json(result);
});
