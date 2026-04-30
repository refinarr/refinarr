import { NextResponse } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { instanceService } from "@/server/services/InstanceService";

export const POST = createApiHandler(async (_req, ctx) => {
  const id = Number(ctx.params.id);
  const ok = await instanceService.testConnection(id);
  return NextResponse.json({ ok });
});
