import { NextRequest, NextResponse } from "next/server";
import { positiveInt } from "@/server/lib/api-errors";
import { createApiHandler } from "@/server/lib/handler";
import { logRepository } from "@/server/repositories/LogRepository";

export const GET = createApiHandler(async (req: NextRequest) => {
  const instanceId = positiveInt(
    req.nextUrl.searchParams.get("instanceId") ?? undefined,
    "instanceId",
  );
  const errors = await logRepository.findFailedByInstance(instanceId);
  return NextResponse.json(errors);
});
