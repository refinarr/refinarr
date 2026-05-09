import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { parseJson } from "@/server/lib/api-errors";
import { movieService } from "@/server/services/MovieService";
import { searchQueueService } from "@/server/services/SearchQueueService";
import { dryRunService } from "@/server/services/DryRunService";
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

  // Delete fires inline; the optional follow-up search goes through the
  // queue (live) or fires inline as a dry-run preview.
  const result = await movieService.deleteFile(
    instanceId,
    mediaId,
    fileId,
    title,
    false,
    { groupId },
  );
  if (search && result.status !== "failed") {
    if (await dryRunService.isDryRun()) {
      await movieService.triggerSearch(instanceId, mediaId, title, { groupId });
    } else {
      await searchQueueService.enqueue({
        instanceId,
        action: "movie",
        mediaId,
        title,
        groupId,
      });
    }
  }
  dataCache.invalidate(instanceId);
  return NextResponse.json(result);
});
