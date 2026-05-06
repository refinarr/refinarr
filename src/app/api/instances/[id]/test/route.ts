import { NextResponse } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { positiveInt } from "@/server/lib/api-errors";
import { instanceService } from "@/server/services/InstanceService";

export const POST = createApiHandler(async (_req, ctx) => {
  const id = positiveInt(ctx.params.id, "id");
  const ok = await instanceService.testConnection(id);
  return NextResponse.json({ ok });
});
