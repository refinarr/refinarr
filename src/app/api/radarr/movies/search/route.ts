import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { movieService } from "@/server/services/MovieService";

export const POST = createApiHandler(async (req: NextRequest) => {
  const { instanceId, mediaId, title } = (await req.json()) as {
    instanceId: number;
    mediaId: number;
    title: string;
  };

  const result = await movieService.triggerSearch(instanceId, mediaId, title);
  return NextResponse.json(result);
});
