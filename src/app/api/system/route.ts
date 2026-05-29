import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { APP_VERSION, BOOTED_AT_MS } from "@/server/lib/build-info";
import { getLatestRelease } from "@/server/lib/github-release";
import type { LatestReleaseInfo, SystemInfo } from "@/shared/types/api";

// Read-only system info for /settings/system. Behind the standard
// deny-by-default proxy — no per-route auth.
//
// `?refresh=1` bypasses the 6h GitHub release cache and forces a
// fresh upstream call. Simpler than a separate POST + invalidate
// dance; lets the diagnostics page implement "Refresh" as a one-shot
// query mutation.
export const GET = createApiHandler(async (req: NextRequest) => {
  const force = req.nextUrl.searchParams.get("refresh") === "1";
  const { release, isStale } = await getLatestRelease({ force });

  const latestRelease: LatestReleaseInfo | null = release
    ? {
        tag: release.tag,
        htmlUrl: release.htmlUrl,
        checkedAtMs: release.fetchedAtMs,
        isStale,
      }
    : null;

  const body: SystemInfo = {
    version: APP_VERSION,
    bootedAtMs: BOOTED_AT_MS,
    node: process.version,
    platform: `${process.platform}/${process.arch}`,
    latestRelease,
  };
  return NextResponse.json(body);
});
