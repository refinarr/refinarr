import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { seriesService } from "@/server/services/SeriesService";
import { sonarrSearchSchema } from "@/shared/types/schemas";

export const POST = createApiHandler(async (req: NextRequest) => {
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = sonarrSearchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid search payload" }, { status: 400 });
  const { instanceId, mediaId, title } = parsed.data;
  const result = await seriesService.triggerSearch(instanceId, mediaId, title);
  return NextResponse.json(result);
});
