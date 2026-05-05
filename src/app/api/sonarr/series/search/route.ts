import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { parseJson } from "@/server/lib/api-errors";
import { seriesService } from "@/server/services/SeriesService";
import { searchQueueService } from "@/server/services/SearchQueueService";
import { dryRunService } from "@/server/services/DryRunService";
import { sonarrSearchSchema } from "@/shared/types/schemas";

export const POST = createApiHandler(async (req: NextRequest) => {
  const { instanceId, mediaId, title } = await parseJson(
    req,
    sonarrSearchSchema,
    "Invalid search payload",
  );

  if (await dryRunService.isDryRun()) {
    const result = await seriesService.triggerSearch(instanceId, mediaId, title);
    return NextResponse.json(result);
  }
  const entry = await searchQueueService.enqueue({ instanceId, action: "series", mediaId, title });
  return NextResponse.json({ queued: true, queueId: entry.id }, { status: 202 });
});
