import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { parseJson } from "@/server/lib/api-errors";
import { seriesService } from "@/server/services/SeriesService";
import { searchQueueService } from "@/server/services/SearchQueueService";
import { dryRunService } from "@/server/services/DryRunService";
import { sonarrSeasonSearchSchema } from "@/shared/types/schemas";

export const POST = createApiHandler(async (req: NextRequest) => {
  const { instanceId, mediaId, seasonNumber, title } = await parseJson(
    req,
    sonarrSeasonSearchSchema,
    "Invalid search payload",
  );

  if (await dryRunService.isDryRun()) {
    const result = await seriesService.triggerSeasonSearch(
      instanceId,
      mediaId,
      seasonNumber,
      title,
    );
    return NextResponse.json(result);
  }
  const entry = await searchQueueService.enqueue({
    instanceId,
    action: "season",
    mediaId,
    title,
    payload: { seasonNumber },
  });
  return NextResponse.json(
    { queued: true, queueId: entry.id },
    { status: 202 },
  );
});
