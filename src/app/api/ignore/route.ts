import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { parseJson, positiveInt } from "@/server/lib/api-errors";
import { ignoreRepository } from "@/server/repositories/IgnoreRepository";
import { dataCache } from "@/server/lib/data-cache";
import { ignoreCreateSchema } from "@/shared/types/schemas";

export const GET = createApiHandler(async (req: NextRequest) => {
  const instanceId = positiveInt(
    req.nextUrl.searchParams.get("instanceId") ?? undefined,
    "instanceId",
  );
  const entries = await ignoreRepository.findByInstance(instanceId);
  return NextResponse.json(entries);
});

export const POST = createApiHandler(async (req: NextRequest) => {
  const data = await parseJson(req, ignoreCreateSchema, "Invalid ignore entry");
  const entry = await ignoreRepository.create(data);
  dataCache.invalidate(data.instanceId);
  return NextResponse.json(entry, { status: 201 });
});
