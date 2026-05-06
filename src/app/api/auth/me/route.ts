import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { unauthorized } from "@/server/lib/api-errors";
import { prisma } from "@/server/lib/db";
import { getSession, SESSION_COOKIE } from "@/server/lib/auth";

export const GET = createApiHandler(async (req: NextRequest) => {
  // Reverse-proxy trust mode: the upstream auth identifies the user.
  if (process.env.TRUST_PROXY_AUTH === "true") {
    const headerName = process.env.PROXY_USER_HEADER ?? "X-Remote-User";
    const remoteUser = req.headers.get(headerName);
    if (remoteUser) {
      return NextResponse.json({ username: remoteUser, source: "proxy" });
    }
  }

  const sessionId = req.cookies.get(SESSION_COOKIE)?.value;
  if (!sessionId) throw unauthorized();
  const session = await getSession(sessionId);
  if (!session) throw unauthorized();
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) throw unauthorized();
  return NextResponse.json({ username: user.username, source: "session" });
});
