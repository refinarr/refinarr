import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { instanceService } from "@/server/services/InstanceService";
import { instanceUpdateSchema } from "@/shared/types/schemas";
import type { Instance } from "@/shared/types/models";
import type { InstanceListItem } from "@/shared/types/api";

function publicView(i: Instance): InstanceListItem {
  return { id: i.id, type: i.type, name: i.name, url: i.url, enabled: i.enabled, createdAt: i.createdAt };
}

export const GET = createApiHandler(async (_req, ctx) => {
  const id = Number(ctx.params.id);
  const instance = await instanceService.getById(id);
  if (!instance) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(publicView(instance));
});

export const PUT = createApiHandler(async (req: NextRequest, ctx) => {
  const id = Number(ctx.params.id);
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = instanceUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid instance update" }, { status: 400 });
  }
  const instance = await instanceService.update(id, parsed.data);
  return NextResponse.json(publicView(instance));
});

export const DELETE = createApiHandler(async (_req, ctx) => {
  const id = Number(ctx.params.id);
  await instanceService.delete(id);
  return NextResponse.json({ ok: true });
});
