import { NextResponse } from "next/server";
import { createApiHandler } from "@/server/lib/handler";

export const GET = createApiHandler(
  async () => NextResponse.json({ status: "ok" }),
  { skipAuth: true }
);
