import { NextResponse } from "next/server";

// /api/health is whitelisted in the proxy, so no createApiHandler wrap needed.
//
// N6 (DB ping) was attempted twice and both broke e2e auth tests in
// hard-to-reproduce ways related to ensureSeeded ordering / libsql
// adapter quirks at first-touch. Left as a static 200 for now; a
// proper readiness probe should live at a separate path (/api/health/db
// or similar) so the e2e webServer probe path stays trivially correct.
export async function GET() {
  return NextResponse.json({ status: "ok" });
}
