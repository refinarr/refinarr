import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { configRepository } from "@/server/repositories/ConfigRepository";
import { dataCache } from "@/server/lib/DataCache";
import { configUpdateSchema } from "@/shared/types/schemas";

export const GET = createApiHandler(async () => {
  const [dryRun, scoringModes] = await Promise.all([
    configRepository.get("dryRun"),
    configRepository.findAll(),
  ]);
  const modes = Object.fromEntries(
    scoringModes
      .filter((c) => c.key.startsWith("scoringMode:"))
      .map((c) => [c.key, c.value])
  );
  // Note: apiKey is intentionally NOT returned here. Use GET /api/config/api-key
  // (re-auth required) to fetch it for scripted access.
  return NextResponse.json({ dryRun: dryRun === "true", scoringModes: modes });
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

  // Scoring-mode changes the flagging logic, so the per-instance flagged-movies
  // / flagged-series cache must be dropped or the page would keep showing the
  // old mode's results until the 5-minute TTL expires.
  for (const [key] of writes) {
    const match = /^scoringMode:(\d+)$/.exec(key);
    if (match) dataCache.invalidate(Number(match[1]));
  }

  return NextResponse.json({ ok: true });
});
