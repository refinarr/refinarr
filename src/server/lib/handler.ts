import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import type { ApiErrorResponse } from "@/shared/types/api";
import { LogSource } from "@/shared/types/models";
import { ensureSeeded } from "./bootstrap";
import { appLogger } from "./app-logger";
import {
  HttpError,
  ZodPayloadError,
  insufficientStorage,
  isStorageFullError,
} from "./api-errors";
import { UnsafeUrlError } from "./url-guard";

export type RouteContext = { params: Promise<Record<string, string>> };

type ResolvedCtx = { params: Record<string, string> };

type RouteHandler = (
  req: NextRequest,
  ctx: ResolvedCtx,
) => Promise<NextResponse>;

interface HandlerOptions {
  // Opt-in `Cache-Control` for safe GET reads. Applied ONLY to 2xx
  // responses (errors return via handleApiError, which never sets it),
  // so a failed fetch is never cached. Use `READ_CACHE` for the standard
  // short revalidate window. NEVER set this on mutations, auth, SSE, or
  // anything returning per-request-sensitive data.
  cacheControl?: string;
}

// Authenticated, per-user/per-instance reads → `private` (a shared proxy
// must not cache+cross-serve them). `max-age=0` forces revalidation, but
// `stale-while-revalidate=30` lets the browser paint instantly from cache
// on reload/new-tab then refresh in the background — the actual perf win,
// with the stale window bounded to 30s.
export const READ_CACHE = "private, max-age=0, stale-while-revalidate=30";

export function createApiHandler(
  handler: RouteHandler,
  options: HandlerOptions = {},
) {
  return async (req: NextRequest, ctx?: RouteContext) => {
    // Reuse the traceId the proxy minted (forwarded as `x-trace-id`)
    // so a single request has one ID across edge + handler logs. Falls
    // back to a fresh UUID for paths that bypass the proxy (e.g. direct
    // imports inside tests).
    const traceId = req.headers.get("x-trace-id") ?? randomUUID();
    const requestContext = {
      traceId,
      method: req.method,
      path: req.nextUrl.pathname,
    };

    try {
      await ensureSeeded();
      // Authentication is handled in the proxy (deny-by-default).
      // By the time a route handler runs, the request is authenticated.
      const resolvedParams = ctx?.params ? await ctx.params : {};
      const res = await handler(req, { params: resolvedParams });
      res.headers.set("X-Trace-Id", traceId);
      // Only cache successful reads; errors must always re-hit the origin.
      if (options.cacheControl && res.ok) {
        res.headers.set("Cache-Control", options.cacheControl);
      }
      return res;
    } catch (err) {
      return handleApiError(err, traceId, requestContext);
    }
  };
}

interface RequestLogContext extends Record<string, unknown> {
  traceId: string;
  method: string;
  path: string;
}

function handleApiError(
  err: unknown,
  traceId: string,
  requestContext: RequestLogContext,
): NextResponse {
  if (err instanceof HttpError) {
    logHttpError(err, requestContext);
    return errorResponse({
      error: err.expose ? err.message : "Internal server error",
      code: err.code,
      traceId,
      status: err.status,
      headers: err.headers,
    });
  }

  const validationResponse = validationErrorResponse(err, traceId);
  if (validationResponse) return validationResponse;

  // Disk-full (SQLITE_FULL / ENOSPC) is an operational condition, not a bug —
  // surface it as a structured 507 STORAGE_FULL so the UI can guide the user
  // to free space, instead of a generic 500. logHttpError persists at warn;
  // if that write itself fails under the same disk pressure, AppLog persist
  // already swallows it (no recursive ENOSPC), so the 507 still returns.
  if (isStorageFullError(err)) {
    const storageError = insufficientStorage();
    logHttpError(storageError, requestContext);
    return errorResponse({
      error: storageError.message,
      code: storageError.code,
      traceId,
      status: storageError.status,
    });
  }

  appLogger.error("Unhandled API error", {
    source: LogSource.Api,
    err,
    context: requestContext,
  });
  return errorResponse({
    error: "Internal server error",
    traceId,
    status: 500,
  });
}

function logHttpError(err: HttpError, requestContext: RequestLogContext): void {
  if (err.logLevel === "warn") {
    appLogger.warn(err.message, {
      source: LogSource.Api,
      context: { ...requestContext, ...err.context },
    });
  }
  if (err.logLevel === "error") {
    appLogger.error(err.message, {
      source: LogSource.Api,
      err,
      context: { ...requestContext, ...err.context },
    });
  }
}

function validationErrorResponse(
  err: unknown,
  traceId: string,
): NextResponse | null {
  if (err instanceof UnsafeUrlError) {
    return errorResponse({ error: err.message, traceId, status: 400 });
  }
  if (err instanceof ZodPayloadError) {
    return errorResponse({ error: err.message, traceId, status: 400 });
  }
  if (err instanceof ZodError) {
    return errorResponse({ error: "Invalid request", traceId, status: 400 });
  }
  return null;
}

interface ErrorResponseOptions extends ApiErrorResponse {
  status: number;
  headers?: HeadersInit;
}

function errorResponse({
  error,
  code,
  traceId,
  status,
  headers,
}: ErrorResponseOptions): NextResponse {
  const body: ApiErrorResponse = code
    ? { error, code, traceId }
    : { error, traceId };
  const res = NextResponse.json(body, { status, headers });
  res.headers.set("X-Trace-Id", traceId);
  return res;
}
