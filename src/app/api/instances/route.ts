import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { parseJson } from "@/server/lib/api-errors";
import { instanceService } from "@/server/services/InstanceService";
import { instanceCreateSchema } from "@/shared/types/schemas";
import type { Instance } from "@/shared/types/models";
import type { InstanceListItem } from "@/shared/types/api";

function publicView(i: Instance): InstanceListItem {
  return {
    id: i.id,
    type: i.type,
    name: i.name,
    url: i.url,
    enabled: i.enabled,
    scoringMode: i.scoringMode,
    searchesPerHour: i.searchesPerHour,
    showAllMedia: i.showAllMedia,
    createdAt: i.createdAt,
  };
}

export const GET = createApiHandler(async () => {
  const instances = await instanceService.getAll();
  return NextResponse.json(instances.map(publicView));
});

export const POST = createApiHandler(async (req: NextRequest) => {
  const data = await parseJson(req, instanceCreateSchema, "Invalid instance");
  const instance = await instanceService.create(data);
  return NextResponse.json(publicView(instance), { status: 201 });
});
