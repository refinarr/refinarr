import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { seriesService } from "@/server/services/SeriesService";
import { sonarrSeasonSearchSchema } from "@/shared/types/schemas";

export const POST = createApiHandler(async (req: NextRequest) => {
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = sonarrSeasonSearchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid search payload" }, { status: 400 });
  const { instanceId, mediaId, seasonNumber, title } = parsed.data;
  const result = await seriesService.triggerSeasonSearch(instanceId, mediaId, seasonNumber, title);
  return NextResponse.json(result);
});
