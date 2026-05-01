import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { seriesService } from "@/server/services/SeriesService";

export const POST = createApiHandler(async (req: NextRequest) => {
  const { instanceId, mediaId, fileIds, title, search = false } = (await req.json()) as {
    instanceId: number;
    mediaId: number;
    fileIds: number[];
    title: string;
    search?: boolean;
  };

  const result = await seriesService.deleteFiles(instanceId, mediaId, fileIds, title, search);
  return NextResponse.json(result);
});
