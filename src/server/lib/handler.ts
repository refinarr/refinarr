import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { ensureSeeded } from "./bootstrap";
import { appLogger } from "./app-logger";
import { LogSource } from "./log-sources";
import { UnsafeUrlError } from "./url-guard";

export type RouteContext = { params: Promise<Record<string, string>> };

type ResolvedCtx = { params: Record<string, string> };

type RouteHandler = (
  req: NextRequest,
  ctx: ResolvedCtx
) => Promise<NextResponse>;

export function createApiHandler(handler: RouteHandler) {
  return async (req: NextRequest, ctx: RouteContext) => {
    try {
      await ensureSeeded();
      // Authentication is handled in the proxy (deny-by-default).
      // By the time a route handler runs, the request is authenticated.
      const resolvedParams = await ctx.params;
      return await handler(req, { params: resolvedParams });
    } catch (err) {
      // Surface validation / safety errors as 400 instead of 500.
      if (err instanceof UnsafeUrlError) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      if (err instanceof ZodError) {
        return NextResponse.json({ error: "Invalid request" }, { status: 400 });
      }
      appLogger.error("Unhandled API error", {
        source: LogSource.Api,
        err,
        context: { method: req.method, path: req.nextUrl.pathname },
      });
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  };
}
