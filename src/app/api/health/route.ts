import { NextResponse } from "next/server";

// /api/health is whitelisted in the proxy, so no createApiHandler wrap needed.
export async function GET() {
  return NextResponse.json({ status: "ok" });
}
