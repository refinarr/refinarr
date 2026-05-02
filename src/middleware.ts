import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/lib/db";
import { SESSION_COOKIE } from "@/server/lib/auth";
import { timingSafeEqual } from "crypto";

export const runtime = "nodejs";

const PUBLIC_API_PATHS = new Set<string>([
  "/api/health",
  "/api/auth/login",
]);

const PUBLIC_PAGE_PATHS = new Set<string>([
  "/login",
]);

async function userExists(): Promise<boolean> {
  const c = await prisma.user.count();
  return c > 0;
}

async function isValidSessionId(id: string): Promise<boolean> {
  const s = await prisma.session.findUnique({ where: { id } });
  if (!s) return false;
  if (s.expiresAt.getTime() < Date.now()) return false;
  return true;
}

function constantTimeMatch(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

async function getStoredApiKey(): Promise<string | null> {
  const row = await prisma.appConfig.findUnique({ where: { key: "apiKey" } });
  return row?.value ?? null;
}

function unauthorized(req: NextRequest, isApi: boolean): NextResponse {
  if (isApi) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(url);
}

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isApi = path.startsWith("/api/");

  // First-run state: no User row yet → force everything to /setup
  const hasUser = await userExists();
  if (!hasUser) {
    if (path === "/setup" || path === "/api/auth/setup") return NextResponse.next();
    if (isApi) return NextResponse.json({ error: "Setup required" }, { status: 401 });
    const url = req.nextUrl.clone();
    url.pathname = "/setup";
    return NextResponse.redirect(url);
  }

  // After setup is done, /setup is a closed door.
  if (path === "/setup" || path === "/api/auth/setup") {
    if (isApi) return NextResponse.json({ error: "Setup already completed" }, { status: 409 });
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // Public paths (small explicit allow-list)
  if (isApi && PUBLIC_API_PATHS.has(path)) return NextResponse.next();
  if (!isApi && PUBLIC_PAGE_PATHS.has(path)) return NextResponse.next();

  // From here on: require a positive auth signal. No "skip auth if X" branches.

  // 1. Session cookie (UI users)
  const sessionId = req.cookies.get(SESSION_COOKIE)?.value;
  if (sessionId && (await isValidSessionId(sessionId))) {
    return NextResponse.next();
  }

  // 2. X-Api-Key header (scripted access)
  const apiKey = req.headers.get("x-api-key");
  if (apiKey) {
    const stored = await getStoredApiKey();
    if (stored && constantTimeMatch(apiKey, stored)) {
      return NextResponse.next();
    }
  }

  // 3. Reverse-proxy trust mode — opt-in only.
  // We deliberately do NOT read X-Forwarded-For for auth
  if (process.env.TRUST_PROXY_AUTH === "true") {
    const headerName = process.env.PROXY_USER_HEADER ?? "X-Remote-User";
    const remoteUser = req.headers.get(headerName);
    if (remoteUser && remoteUser.length > 0) {
      return NextResponse.next();
    }
  }

  return unauthorized(req, isApi);
}

export const config = {
  matcher: [
    // Run on everything except Next internals and the favicon.
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
