import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { seriesService } from "@/server/services/SeriesService";

export const POST = createApiHandler(async (req: NextRequest) => {
  const { instanceId, mediaId, fileId, title } = (await req.json()) as {
    instanceId: number;
    mediaId: number;
    fileId: number;
    title: string;
  };

  const result = await seriesService.triggerEpisodeFileSearch(instanceId, mediaId, fileId, title);
  return NextResponse.json(result);
});
