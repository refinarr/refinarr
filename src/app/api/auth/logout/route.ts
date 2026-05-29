import { NextRequest, NextResponse } from "next/server";
import { deleteSession, SESSION_COOKIE } from "@/server/lib/auth";
import { createApiHandler } from "@/server/lib/handler";

export const POST = createApiHandler(async (req: NextRequest) => {
  const sessionId = req.cookies.get(SESSION_COOKIE)?.value;
  if (sessionId) await deleteSession(sessionId);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", expires: new Date(0) });
  return res;
});
