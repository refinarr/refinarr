import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { movieService } from "@/server/services/MovieService";

export const POST = createApiHandler(async (req: NextRequest) => {
  const { instanceId, mediaId, fileId, title, search = false } = (await req.json()) as {
    instanceId: number;
    mediaId: number;
    fileId: number;
    title: string;
    search?: boolean;
  };

  const result = await movieService.deleteFile(instanceId, mediaId, fileId, title, search);
  return NextResponse.json(result);
});
