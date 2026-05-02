import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { movieService } from "@/server/services/MovieService";
import { dataCache } from "@/server/lib/DataCache";
import { radarrDeleteSchema } from "@/shared/types/schemas";

export const POST = createApiHandler(async (req: NextRequest) => {
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = radarrDeleteSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid delete payload" }, { status: 400 });
  const { instanceId, mediaId, fileId, title, search = false } = parsed.data;
  const result = await movieService.deleteFile(instanceId, mediaId, fileId, title, search);
  dataCache.invalidate(instanceId);
  return NextResponse.json(result);
});
