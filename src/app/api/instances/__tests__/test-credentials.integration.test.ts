import { describe, test, expect } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/instances/test/route";
import { mswServer, radarrHandlers } from "@/test/msw";

const baseUrl = "http://192.168.1.10:7878";
const ctxNone = { params: Promise.resolve({}) };

function postReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/instances/test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/instances/test (stateless)", () => {
  test("ok: true when upstream returns 200", async () => {
    mswServer.use(...radarrHandlers({ baseUrl }, { systemStatus: { status: 200 } }));
    const res = await POST(
      postReq({ type: "radarr", url: baseUrl, apiKey: "abcd1234abcd1234abcd1234abcd1234" }),
      ctxNone,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  test("ok: false when upstream returns 403", async () => {
    mswServer.use(...radarrHandlers({ baseUrl }, { systemStatus: { status: 403 } }));
    const res = await POST(
      postReq({ type: "radarr", url: baseUrl, apiKey: "wrong-key-wrong-key-wrong-key-00" }),
      ctxNone,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: false });
  });

  test("rejects SSRF URL (cloud metadata) with 400", async () => {
    const res = await POST(
      postReq({ type: "radarr", url: "http://169.254.169.254/", apiKey: "abcd1234abcd1234abcd1234abcd1234" }),
      ctxNone,
    );
    expect(res.status).toBe(400);
  });

  test("rejects schema-failing payload (missing apiKey) with 400", async () => {
    const res = await POST(postReq({ type: "radarr", url: baseUrl }), ctxNone);
    expect(res.status).toBe(400);
  });

  test("rejects malformed JSON with 400", async () => {
    const req = new NextRequest("http://localhost/api/instances/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json{",
    });
    const res = await POST(req, ctxNone);
    expect(res.status).toBe(400);
  });
});
