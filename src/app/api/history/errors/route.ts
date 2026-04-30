import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { logRepository } from "@/server/repositories/LogRepository";

export const GET = createApiHandler(async (req: NextRequest) => {
  const instanceId = Number(req.nextUrl.searchParams.get("instanceId"));
  const errors = await logRepository.findFailedByInstance(instanceId);
  return NextResponse.json(errors);
});
