import { describe, test, expect, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

vi.mock("@/server/lib/db", () => ({
  prisma: {},
}));

vi.mock("@/server/lib/bootstrap", () => ({
  ensureSeeded: vi.fn().mockResolvedValue(undefined),
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
import { badRequest, parseJson, tooManyRequests } from "@/server/lib/api-errors";
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
    expect(res.headers.get("X-Trace-Id")).toBeTruthy();
    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });

  test("UnsafeUrlError from handler returns 400", async () => {
    const handler = createApiHandler(async () => {
      throw new UnsafeUrlError("Blocked host");
    });
    const res = await handler(makeReq(), makeCtx());
    expect(res.status).toBe(400);
    expect(res.headers.get("X-Trace-Id")).toBeTruthy();
    const body = await res.json();
    expect(body.error).toBe("Blocked host");
    expect(body.traceId).toBe(res.headers.get("X-Trace-Id"));
  });

  test("ZodError from handler returns 400 with generic message", async () => {
    const handler = createApiHandler(async () => {
      // ZodError constructor requires issues array
      throw new ZodError([
        {
          code: "invalid_type",
          expected: "string",
          input: 42,
          path: ["name"],
          message: "Expected string",
        },
      ]);
    });
    const res = await handler(makeReq(), makeCtx());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid request");
    expect(body.traceId).toBe(res.headers.get("X-Trace-Id"));
  });

  test("generic Error from handler returns 500", async () => {
    const handler = createApiHandler(async () => {
      throw new Error("Something went wrong");
    });
    const res = await handler(makeReq(), makeCtx());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Internal server error");
    expect(body.traceId).toBe(res.headers.get("X-Trace-Id"));
  });

  test("HttpError from handler returns canonical error response", async () => {
    const handler = createApiHandler(async () => {
      throw badRequest("Nope", "NOPE");
    });
    const res = await handler(makeReq(), makeCtx());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({
      error: "Nope",
      code: "NOPE",
      traceId: res.headers.get("X-Trace-Id"),
    });
  });

  test("HttpError preserves retry-after header", async () => {
    const handler = createApiHandler(async () => {
      throw tooManyRequests("Slow down", 2500);
    });
    const res = await handler(makeReq(), makeCtx());
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("3");
  });

  test("parseJson maps invalid JSON and invalid schema payloads", async () => {
    const { z } = await import("zod");
    const invalidJsonReq = new NextRequest("http://localhost/api/test", {
      method: "POST",
      body: "{",
    });
    await expect(parseJson(invalidJsonReq, z.object({ name: z.string() }), "Invalid thing"))
      .rejects
      .toThrow("Invalid JSON");

    const invalidPayloadReq = new NextRequest("http://localhost/api/test", {
      method: "POST",
      body: JSON.stringify({ name: 42 }),
    });
    await expect(parseJson(invalidPayloadReq, z.object({ name: z.string() }), "Invalid thing"))
      .rejects
      .toThrow("Invalid thing");
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
