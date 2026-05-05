import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/lib/db";
import { getSession, SESSION_COOKIE } from "@/server/lib/auth";

export async function GET(req: NextRequest) {
  // Reverse-proxy trust mode: the upstream auth identifies the user.
  if (process.env.TRUST_PROXY_AUTH === "true") {
    const headerName = process.env.PROXY_USER_HEADER ?? "X-Remote-User";
    const remoteUser = req.headers.get(headerName);
    if (remoteUser) {
      return NextResponse.json({ username: remoteUser, source: "proxy" });
    }
  }

  const sessionId = req.cookies.get(SESSION_COOKIE)?.value;
  if (!sessionId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const session = await getSession(sessionId);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ username: user.username, source: "session" });
}
