import { describe, test, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

vi.mock("@/server/lib/db", () => ({
  prisma: {},
  seedDefaults: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/server/lib/app-logger", () => ({
  appLogger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { createApiHandler } from "@/server/lib/handler";
import { UnsafeUrlError } from "@/server/lib/url-guard";

function makeReq(path = "/api/test"): NextRequest {
  return new NextRequest(`http://localhost${path}`);
}

function makeCtx(params: Record<string, string> = {}) {
  return { params: Promise.resolve(params) };
}

describe("createApiHandler", () => {
  test("passes through successful handler response", async () => {
    const handler = createApiHandler(async () =>
      NextResponse.json({ ok: true }, { status: 200 })
    );
    const res = await handler(makeReq(), makeCtx());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });

  test("UnsafeUrlError from handler returns 400", async () => {
    const handler = createApiHandler(async () => {
      throw new UnsafeUrlError("Blocked host");
    });
    const res = await handler(makeReq(), makeCtx());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Blocked host");
  });

  test("ZodError from handler returns 400 with generic message", async () => {
    const handler = createApiHandler(async () => {
      // ZodError constructor requires issues array
      const err = new ZodError([
        {
          code: "invalid_type",
          expected: "string",
          received: "number",
          path: ["name"],
          message: "Expected string",
        },
      ]);
      throw err;
    });
    const res = await handler(makeReq(), makeCtx());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid request");
  });

  test("generic Error from handler returns 500", async () => {
    const handler = createApiHandler(async () => {
      throw new Error("Something went wrong");
    });
    const res = await handler(makeReq(), makeCtx());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Internal server error");
  });

  test("resolves params from ctx", async () => {
    let capturedParams: Record<string, string> = {};
    const handler = createApiHandler(async (_req, ctx) => {
      capturedParams = ctx.params;
      return NextResponse.json({});
    });
    await handler(makeReq(), makeCtx({ id: "42" }));
    expect(capturedParams).toEqual({ id: "42" });
  });
});
