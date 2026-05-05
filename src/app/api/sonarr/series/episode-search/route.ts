import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { seriesService } from "@/server/services/SeriesService";
import { searchQueueService } from "@/server/services/SearchQueueService";
import { dryRunService } from "@/server/services/DryRunService";
import { sonarrEpisodeSearchSchema } from "@/shared/types/schemas";

export const POST = createApiHandler(async (req: NextRequest) => {
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = sonarrEpisodeSearchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid search payload" }, { status: 400 });
  const { instanceId, mediaId, fileId, title } = parsed.data;

  if (await dryRunService.isDryRun()) {
    const result = await seriesService.triggerEpisodeFileSearch(instanceId, mediaId, fileId, title);
    return NextResponse.json(result);
  }
  const entry = await searchQueueService.enqueue({
    instanceId, action: "episode", mediaId, title, payload: { fileId },
  });
  return NextResponse.json({ queued: true, queueId: entry.id }, { status: 202 });
});
