import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { ZodError } from "zod";
import { ensureSeeded } from "./bootstrap";
import { appLogger } from "./app-logger";
import { HttpError, ZodPayloadError } from "./api-errors";
import { LogSource } from "./log-sources";
import { UnsafeUrlError } from "./url-guard";
import type { ApiErrorResponse } from "@/shared/types/api";

export type RouteContext = { params: Promise<Record<string, string>> };

type ResolvedCtx = { params: Record<string, string> };

type RouteHandler = (
  req: NextRequest,
  ctx: ResolvedCtx,
) => Promise<NextResponse>;

export function createApiHandler(handler: RouteHandler) {
  return async (req: NextRequest, ctx?: RouteContext) => {
    const traceId = randomUUID();
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
