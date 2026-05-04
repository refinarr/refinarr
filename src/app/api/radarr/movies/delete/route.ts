import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { movieService } from "@/server/services/MovieService";
import { searchQueueService } from "@/server/services/SearchQueueService";
import { dryRunService } from "@/server/services/DryRunService";
import { dataCache } from "@/server/lib/DataCache";
import { radarrDeleteSchema } from "@/shared/types/schemas";

export const POST = createApiHandler(async (req: NextRequest) => {
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = radarrDeleteSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid delete payload" }, { status: 400 });
  const { instanceId, mediaId, fileId, title, search = false } = parsed.data;

  // Delete fires inline; the optional follow-up search goes through the
  // queue (live) or fires inline as a dry-run preview.
  const result = await movieService.deleteFile(instanceId, mediaId, fileId, title, false);
  if (search && result.status !== "failed") {
    if (await dryRunService.isDryRun()) {
      await movieService.triggerSearch(instanceId, mediaId, title);
    } else {
      await searchQueueService.enqueue({ instanceId, action: "movie", mediaId, title });
    }
  }
  dataCache.invalidate(instanceId);
  return NextResponse.json(result);
});
