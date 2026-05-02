import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { instanceService } from "@/server/services/InstanceService";
import { instanceCreateSchema } from "@/shared/types/schemas";
import type { Instance } from "@/shared/types/models";
import type { InstanceListItem } from "@/shared/types/api";

function publicView(i: Instance): InstanceListItem {
  return { id: i.id, type: i.type, name: i.name, url: i.url, enabled: i.enabled, createdAt: i.createdAt };
}

export const GET = createApiHandler(async () => {
  const instances = await instanceService.getAll();
  return NextResponse.json(instances.map(publicView));
});

export const POST = createApiHandler(async (req: NextRequest) => {
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = instanceCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid instance" }, { status: 400 });
  }
  const instance = await instanceService.create(parsed.data);
  return NextResponse.json(publicView(instance), { status: 201 });
});
