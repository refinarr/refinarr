import { randomUUID, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { configRepository } from "@/server/repositories/ConfigRepository";
import { userRepository } from "@/server/repositories/UserRepository";
import { sessionRepository } from "@/server/repositories/SessionRepository";
import { ConfigKey } from "@/server/config/keys";
import { SESSION_COOKIE } from "@/server/lib/auth";
import type { ApiErrorResponse } from "@/shared/types/api";

// Next.js 16: Proxy always runs on Node.js — no `export const runtime` needed.

const PUBLIC_API_PATHS = new Set<string>(["/api/health", "/api/auth/login"]);

const PUBLIC_PAGE_PATHS = new Set<string>(["/login"]);

// Content-Security-Policy:
//   - default-src 'self'           — only same-origin by default
//   - script-src 'unsafe-inline'   — Next.js injects inline runtime bootstrap;
//     ('unsafe-eval' in dev only)    React's dev-mode source-map reconstruction
//                                    needs eval; production never uses it
//   - style-src 'unsafe-inline'    — Tailwind / shadcn inject inline styles
//   - font-src 'self' data:        — Geist is self-hosted via next/font/google;
//                                    data: covers icon-font fallbacks
//   - img-src 'self' data: blob:   — covers shadcn skeletons + uploaded blobs
//   - connect-src 'self'           — the app only hits its own /api/*; upstream
//     (+ ws:/wss: in dev for HMR)    *arr calls happen server-side
//   - frame-ancestors 'none'       — no embedding
//   - form-action 'self'           — login/setup posts stay on-origin
//   - base-uri 'self'              — block <base> hijacks
const isDev = process.env.NODE_ENV !== "production";
const CSP_POLICY = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob:",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
].join("; ");

function withSecurityHeaders(res: NextResponse, traceId: string): NextResponse {
  res.headers.set("Content-Security-Policy", CSP_POLICY);
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("X-Trace-Id", traceId);
  return res;
}

// Forward `x-trace-id` on the *request* so `createApiHandler` reuses
// it instead of minting a new one — guarantees one ID for edge + handler
// logs of the same request.
function passThrough(req: NextRequest, traceId: string): NextResponse {
  const forwarded = new Headers(req.headers);
  forwarded.set("x-trace-id", traceId);
  return NextResponse.next({ request: { headers: forwarded } });
}

function apiError(
  status: number,
  error: string,
  code: string,
  traceId: string,
): NextResponse {
  const body: ApiErrorResponse = { error, code, traceId };
  return NextResponse.json(body, { status });
}

async function userExists(): Promise<boolean> {
  return (await userRepository.count()) > 0;
}

async function isValidSessionId(id: string): Promise<boolean> {
  const s = await sessionRepository.findByToken(id);
  if (!s) return false;
  return s.expiresAt.getTime() >= Date.now();
}

function constantTimeMatch(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

async function getStoredApiKey(): Promise<string | null> {
  return configRepository.getTyped(ConfigKey.ApiKey);
}

function unauthorized(
  req: NextRequest,
  isApi: boolean,
  traceId: string,
): NextResponse {
  if (isApi) {
    return apiError(401, "Unauthorized", "UNAUTHORIZED", traceId);
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(url);
}

// Force /setup before first user is created; close /setup once a user exists.
// Returns the response to send, or null if the request should continue.
async function setupGate(
  req: NextRequest,
  path: string,
  isApi: boolean,
  traceId: string,
): Promise<NextResponse | null> {
  const isSetupPath = path === "/setup" || path === "/api/auth/setup";
  const hasUser = await userExists();

  if (!hasUser) {
    if (isSetupPath) return passThrough(req, traceId);
    if (isApi)
      return apiError(401, "Setup required", "SETUP_REQUIRED", traceId);
    const url = req.nextUrl.clone();
    url.pathname = "/setup";
    return NextResponse.redirect(url);
  }

  if (isSetupPath) {
    if (isApi)
      return apiError(
        409,
        "Setup already completed",
        "SETUP_COMPLETED",
        traceId,
      );
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return null;
}

function isPublicPath(path: string, isApi: boolean): boolean {
  return isApi ? PUBLIC_API_PATHS.has(path) : PUBLIC_PAGE_PATHS.has(path);
}

// True if any authentication signal accepts this request.
// Order: session cookie → X-Api-Key → reverse-proxy header (opt-in).
// We deliberately do NOT read X-Forwarded-For for auth decisions.
async function hasValidAuth(req: NextRequest): Promise<boolean> {
  const sessionId = req.cookies.get(SESSION_COOKIE)?.value;
  if (sessionId && (await isValidSessionId(sessionId))) return true;

  const apiKey = req.headers.get("x-api-key");
  if (apiKey) {
    const stored = await getStoredApiKey();
    if (stored && constantTimeMatch(apiKey, stored)) return true;
  }

  if (process.env.TRUST_PROXY_AUTH === "true") {
    const headerName = process.env.PROXY_USER_HEADER ?? "X-Remote-User";
    const remoteUser = req.headers.get(headerName);
    if (remoteUser && remoteUser.length > 0) return true;
  }

  return false;
}

export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isApi = path.startsWith("/api/");
  const traceId = randomUUID();

  // Health endpoint is always public — must bypass userExists() so the webServer
  // health check resolves to 200 before any user is created.
  if (path === "/api/health")
    return withSecurityHeaders(passThrough(req, traceId), traceId);

  const setupResp = await setupGate(req, path, isApi, traceId);
  if (setupResp) return withSecurityHeaders(setupResp, traceId);

  if (isPublicPath(path, isApi))
    return withSecurityHeaders(passThrough(req, traceId), traceId);

  if (await hasValidAuth(req))
    return withSecurityHeaders(passThrough(req, traceId), traceId);

  return withSecurityHeaders(unauthorized(req, isApi, traceId), traceId);
}

export const config = {
  matcher: [
    // Run on everything except Next internals and the favicon.
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
