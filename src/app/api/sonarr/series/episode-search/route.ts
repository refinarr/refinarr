import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { parseJson } from "@/server/lib/api-errors";
import { seriesService } from "@/server/services/SeriesService";
import { searchQueueService } from "@/server/services/SearchQueueService";
import { dryRunService } from "@/server/services/DryRunService";
import { sonarrEpisodeSearchSchema } from "@/shared/types/schemas";

export const POST = createApiHandler(async (req: NextRequest) => {
  const { instanceId, mediaId, fileId, title, groupId } = await parseJson(
    req,
    sonarrEpisodeSearchSchema,
    "Invalid search payload",
  );

  if (await dryRunService.isDryRun()) {
    const result = await seriesService.triggerEpisodeFileSearch(
      instanceId,
      mediaId,
      fileId,
      title,
      { groupId },
    );
    return NextResponse.json(result);
  }
  const entry = await searchQueueService.enqueue({
    instanceId,
    action: "episode",
    mediaId,
    title,
    payload: { fileId },
    groupId,
  });
  return NextResponse.json(
    { queued: true, queueId: entry.id },
    { status: 202 },
  );
});
