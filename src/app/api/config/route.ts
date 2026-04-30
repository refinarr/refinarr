import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { configRepository } from "@/server/repositories/ConfigRepository";

export const GET = createApiHandler(async () => {
  const [dryRun, apiKey, scoringModes] = await Promise.all([
    configRepository.get("dryRun"),
    configRepository.get("apiKey"),
    configRepository.findAll(),
  ]);
  const modes = Object.fromEntries(
    scoringModes
      .filter((c) => c.key.startsWith("scoringMode:"))
      .map((c) => [c.key, c.value])
  );
  return NextResponse.json({ dryRun: dryRun === "true", apiKey, scoringModes: modes });
});

export const PUT = createApiHandler(async (req: NextRequest) => {
  const body = await req.json();
  await Promise.all(
    Object.entries(body).map(([key, value]) =>
      configRepository.set(key, String(value))
    )
  );
  return NextResponse.json({ ok: true });
});
