import { NextRequest, NextResponse } from "next/server";
import { prisma, seedDefaults } from "./db";
import { appLogger } from "./app-logger";

let seeded = false;

async function ensureSeeded() {
  if (!seeded) {
    await seedDefaults();
    seeded = true;
  }
}

interface HandlerOptions {
  skipAuth?: boolean;
}

export type RouteContext = { params: Promise<Record<string, string>> };

type ResolvedCtx = { params: Record<string, string> };

type RouteHandler = (
  req: NextRequest,
  ctx: ResolvedCtx
) => Promise<NextResponse>;

export function createApiHandler(
  handler: RouteHandler,
  options: HandlerOptions = {}
) {
  return async (req: NextRequest, ctx: RouteContext) => {
    try {
      await ensureSeeded();

      if (!options.skipAuth) {
        // Same-origin browser requests are always allowed
        const isBrowser = req.headers.get("sec-fetch-site") === "same-origin";
        if (!isBrowser) {
          const config = await prisma.appConfig.findUnique({
            where: { key: "apiKey" },
          });
          const expected = config?.value;
          const provided = req.headers.get("x-api-key");
          if (!expected || provided !== expected) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
          }
        }
      }

      const resolvedParams = await ctx.params;
      return await handler(req, { params: resolvedParams });
    } catch (err) {
      appLogger.error("Unhandled API error", {
        source: "api",
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
