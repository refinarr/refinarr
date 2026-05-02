import { NextResponse } from "next/server";

// /api/health is whitelisted in middleware, so no createApiHandler wrap needed.
export async function GET() {
  return NextResponse.json({ status: "ok" });
}
