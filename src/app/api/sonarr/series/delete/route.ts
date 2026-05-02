import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { seriesService } from "@/server/services/SeriesService";
import { dataCache } from "@/server/lib/DataCache";

export const POST = createApiHandler(async (req: NextRequest) => {
  const { instanceId, mediaId, fileIds, title, search = false } = (await req.json()) as {
    instanceId: number;
    mediaId: number;
    fileIds: number[];
    title: string;
    search?: boolean;
  };

  const result = await seriesService.deleteFiles(instanceId, mediaId, fileIds, title, search);
  dataCache.invalidate(instanceId);
  return NextResponse.json(result);
});
