import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { movieService } from "@/server/services/MovieService";
import { searchQueueService } from "@/server/services/SearchQueueService";
import { dryRunService } from "@/server/services/DryRunService";
import { radarrSearchSchema } from "@/shared/types/schemas";
import { parseJson } from "@/server/lib/api-errors";

export const POST = createApiHandler(async (req: NextRequest) => {
  const { instanceId, mediaId, title } = await parseJson(
    req,
    radarrSearchSchema,
    "Invalid search payload",
  );

  if (await dryRunService.isDryRun()) {
    const result = await movieService.triggerSearch(instanceId, mediaId, title);
    return NextResponse.json(result);
  }
  const entry = await searchQueueService.enqueue({
    instanceId,
    action: "movie",
    mediaId,
    title,
  });
  return NextResponse.json(
    { queued: true, queueId: entry.id },
    { status: 202 },
  );
});
