import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { instanceService } from "@/server/services/InstanceService";

export const GET = createApiHandler(async (_req, ctx) => {
  const id = Number(ctx.params.id);
  const instance = await instanceService.getById(id);
  if (!instance) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(instance);
});

export const PUT = createApiHandler(async (req: NextRequest, ctx) => {
  const id = Number(ctx.params.id);
  const body = await req.json();
  const instance = await instanceService.update(id, body);
  return NextResponse.json(instance);
});

export const DELETE = createApiHandler(async (_req, ctx) => {
  const id = Number(ctx.params.id);
  await instanceService.delete(id);
  return NextResponse.json({ ok: true });
});
