import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/lib/db";
import { appLogger } from "@/server/lib/app-logger";
import { createApiHandler } from "@/server/lib/handler";
import { LogSource } from "@/shared/types/models";

// /api/health is whitelisted in the proxy for AUTH (anyone can hit it
// without a session) but wraps with createApiHandler so ensureSeeded()
// runs before the first Prisma touch — critical for orchestrator
// probes that may be the first request after boot. Failure to seed
// surfaces as 500 here rather than a spurious 200 that hides a
// broken DB.
//
// Probes via prisma.appConfig.findFirst() (not $queryRaw — adapter
// quirks bit us under the previous libsql setup). 503 on DB error so
// Docker/k8s can distinguish 'process up' from 'process up AND DB
// reachable AND seeded'.
export const GET = createApiHandler(async (_req: NextRequest) => {
  try {
    await prisma.appConfig.findFirst();
    return NextResponse.json({ status: "ok", db: "ok" });
  } catch (err) {
    appLogger.warn("Health probe DB query failed", {
      source: LogSource.Api,
      err,
    });
    return NextResponse.json(
      { status: "degraded", db: "error" },
      { status: 503 },
    );
  }
});
