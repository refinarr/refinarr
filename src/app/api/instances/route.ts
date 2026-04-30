import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { instanceService } from "@/server/services/InstanceService";

export const GET = createApiHandler(async () => {
  const instances = await instanceService.getAll();
  return NextResponse.json(instances);
});

export const POST = createApiHandler(async (req: NextRequest) => {
  const body = await req.json();
  const instance = await instanceService.create(body);
  return NextResponse.json(instance, { status: 201 });
});
