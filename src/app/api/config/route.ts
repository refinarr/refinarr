import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { configRepository } from "@/server/repositories/ConfigRepository";
import { ConfigKey } from "@/server/config/keys";
import { configUpdateSchema } from "@/shared/types/schemas";

export const GET = createApiHandler(async () => {
  const dryRun = await configRepository.getTyped(ConfigKey.DryRun);
  // Note: apiKey is intentionally NOT returned here. Use GET /api/config/api-key
  // (re-auth required) to fetch it for scripted access.
  return NextResponse.json({ dryRun });
});

export const PUT = createApiHandler(async (req: NextRequest) => {
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = configUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid config" }, { status: 400 });
  }
  // Defense-in-depth: never let a config PUT modify the API key or other reserved keys.
  const RESERVED = new Set(["apiKey"]);
  const writes = Object.entries(parsed.data).filter(([key]) => !RESERVED.has(key));
  await Promise.all(writes.map(([key, value]) => configRepository.set(key, String(value))));

  return NextResponse.json({ ok: true });
});
