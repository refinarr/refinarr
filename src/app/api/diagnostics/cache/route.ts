import { NextResponse } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { dataCache } from "@/server/lib/data-cache";
import type { ClearDiagnosticsCacheResponse } from "@/shared/types/api";

// In-memory cache stats for /settings/diagnostics. Behind the standard
// deny-by-default proxy — no per-route auth check needed.
export const GET = createApiHandler(async () => {
  return NextResponse.json(dataCache.getStats());
});

// Manual cache flush from the diagnostics UI's "Clear cache" button.
// Resets entries, in-flight rebuilds, and the hit/miss/eviction counters
// — see DataCache.clear() for the contract.
export const DELETE = createApiHandler(async () => {
  dataCache.clear();
  const body: ClearDiagnosticsCacheResponse = { ok: true };
  return NextResponse.json(body);
});
