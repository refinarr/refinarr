import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { seriesService } from "@/server/services/SeriesService";
import { searchQueueService } from "@/server/services/SearchQueueService";
import { dryRunService } from "@/server/services/DryRunService";
import { dataCache } from "@/server/lib/DataCache";
import { sonarrDeleteSchema } from "@/shared/types/schemas";

export const POST = createApiHandler(async (req: NextRequest) => {
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = sonarrDeleteSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid delete payload" }, { status: 400 });
  const { instanceId, mediaId, fileIds, title, search = false } = parsed.data;

  const result = await seriesService.deleteFiles(instanceId, mediaId, fileIds, title, false);
  if (search && result.status !== "failed") {
    if (await dryRunService.isDryRun()) {
      await seriesService.triggerSearch(instanceId, mediaId, title);
    } else {
      await searchQueueService.enqueue({ instanceId, action: "series", mediaId, title });
    }
  }
  dataCache.invalidate(instanceId);
  return NextResponse.json(result);
});
