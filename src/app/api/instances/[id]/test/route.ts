import { NextResponse } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { instanceService } from "@/server/services/InstanceService";

export const POST = createApiHandler(async (_req, ctx) => {
  const id = Number(ctx.params.id);
  if (!Number.isInteger(id) || id <= 0)
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  const ok = await instanceService.testConnection(id);
  return NextResponse.json({ ok });
});
