import { describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const { appLoggerMock } = vi.hoisted(() => ({
  appLoggerMock: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/server/lib/app-logger", () => ({
  appLogger: appLoggerMock,
}));

import { POST } from "@/app/api/logs/client/route";

function makeReq(body: unknown, ip = crypto.randomUUID()): NextRequest {
  return new NextRequest("http://localhost/api/logs/client", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

describe("POST /api/logs/client", () => {
  test("rejects invalid payloads", async () => {
    const res = await POST(makeReq({ path: "/x" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid client error report");
    expect(body.traceId).toBe(res.headers.get("X-Trace-Id"));
  });

  test("logs valid client reports", async () => {
    const res = await POST(
      makeReq({
        message: "Client blew up apikey=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        path: "/dashboard",
        method: "GET",
        status: 500,
        traceId: "trace-123",
        component: "Dashboard",
        stack: "Error: nope",
      }),
    );
    expect(res.status).toBe(200);
    expect(appLoggerMock.error).toHaveBeenCalledWith(
      "Client blew up apikey=***",
      {
        source: "client",
        context: expect.objectContaining({
          path: "/dashboard",
          method: "GET",
          status: 500,
          traceId: "trace-123",
          component: "Dashboard",
        }),
      },
    );
  });

  test("rate-limits spam", async () => {
    const ip = crypto.randomUUID();
    for (let i = 0; i < 30; i += 1) {
      const res = await POST(makeReq({ message: `m${i}`, path: "/x" }, ip));
      expect(res.status).toBe(200);
    }
    const limited = await POST(makeReq({ message: "blocked", path: "/x" }, ip));
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBeTruthy();
  });
});
