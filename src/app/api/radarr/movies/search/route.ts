import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { movieService } from "@/server/services/MovieService";
import { searchQueueService } from "@/server/services/SearchQueueService";
import { dryRunService } from "@/server/services/DryRunService";
import { radarrSearchSchema } from "@/shared/types/schemas";

export const POST = createApiHandler(async (req: NextRequest) => {
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = radarrSearchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid search payload" }, { status: 400 });
  const { instanceId, mediaId, title } = parsed.data;

  if (await dryRunService.isDryRun()) {
    const result = await movieService.triggerSearch(instanceId, mediaId, title);
    return NextResponse.json(result);
  }
  const entry = await searchQueueService.enqueue({ instanceId, action: "movie", mediaId, title });
  return NextResponse.json({ queued: true, queueId: entry.id }, { status: 202 });
});
