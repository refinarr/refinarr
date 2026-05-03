import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { instanceService } from "@/server/services/InstanceService";
import { instanceTestSchema } from "@/shared/types/schemas";

export const POST = createApiHandler(async (req: NextRequest) => {
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = instanceTestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid test payload" }, { status: 400 });
  }
  const ok = await instanceService.testCredentials(parsed.data);
  return NextResponse.json({ ok });
});
