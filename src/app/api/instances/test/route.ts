import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { parseJson } from "@/server/lib/api-errors";
import { instanceService } from "@/server/services/InstanceService";
import { instanceTestSchema } from "@/shared/types/schemas";

export const POST = createApiHandler(async (req: NextRequest) => {
  const data = await parseJson(req, instanceTestSchema, "Invalid test payload");
  const ok = await instanceService.testCredentials(data);
  return NextResponse.json({ ok });
});
