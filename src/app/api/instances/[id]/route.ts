import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { instanceService } from "@/server/services/InstanceService";
import { dataCache } from "@/server/lib/DataCache";
import { instanceUpdateSchema } from "@/shared/types/schemas";
import type { Instance } from "@/shared/types/models";
import type { InstanceListItem } from "@/shared/types/api";

function publicView(i: Instance): InstanceListItem {
  return { id: i.id, type: i.type, name: i.name, url: i.url, enabled: i.enabled, scoringMode: i.scoringMode, searchesPerHour: i.searchesPerHour, createdAt: i.createdAt };
}

export const GET = createApiHandler(async (_req, ctx) => {
  const id = Number(ctx.params.id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  const instance = await instanceService.getById(id);
  if (!instance) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(publicView(instance));
});

export const PUT = createApiHandler(async (req: NextRequest, ctx) => {
  const id = Number(ctx.params.id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = instanceUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid instance update" }, { status: 400 });
  }
  const instance = await instanceService.update(id, parsed.data);
  // URL / API key / enabled changes mean the cached movies/series snapshot
  // points at the old upstream (or stale disabled state). Drop it so the
  // next fetch refreshes from the new instance config.
  dataCache.invalidate(id);
  return NextResponse.json(publicView(instance));
});

export const DELETE = createApiHandler(async (_req, ctx) => {
  const id = Number(ctx.params.id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  await instanceService.delete(id);
  dataCache.invalidate(id);
  return NextResponse.json({ ok: true });
});
