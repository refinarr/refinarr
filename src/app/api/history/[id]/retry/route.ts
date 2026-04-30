import { NextResponse } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { logRepository } from "@/server/repositories/LogRepository";
import { movieService } from "@/server/services/MovieService";
import { seriesService } from "@/server/services/SeriesService";

export const POST = createApiHandler(async (_req, ctx) => {
  const id = Number(ctx.params.id);
  const log = await logRepository.findById(id);
  if (!log || !log.payload) {
    return NextResponse.json({ error: "Log entry not found or has no payload" }, { status: 404 });
  }

  const payload = JSON.parse(log.payload) as Record<string, unknown>;
  const action = payload.action as string;
  const instanceId = payload.instanceId as number;
  const mediaId = payload.mediaId as number;
  const title = payload.title as string;

  let result;
  if (action === "search" && payload.type === "sonarr") {
    result = await seriesService.triggerSearch(instanceId, mediaId, title);
  } else if (action === "search") {
    result = await movieService.triggerSearch(instanceId, mediaId, title);
  } else if (action === "delete_blacklist") {
    result = await movieService.deleteAndBlacklist(instanceId, mediaId, payload.fileId as number, title);
  } else {
    return NextResponse.json({ error: "Cannot retry this action type" }, { status: 400 });
  }

  return NextResponse.json(result);
});
