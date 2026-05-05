import { describe, test, expect } from "vitest";
import { NextRequest } from "next/server";
import { GET, PUT } from "@/app/api/preferences/route";
import { prisma } from "@/server/lib/db";

const ctxNone = { params: Promise.resolve({}) };

function getReq(qs: string) {
  return new NextRequest(`http://localhost/api/preferences?${qs}`, {
    method: "GET",
  });
}
function putReq(body: unknown) {
  return new NextRequest("http://localhost/api/preferences", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PUT /api/preferences", () => {
  test("inserts CF preferences for the instance", async () => {
    const res = await PUT(
      putReq({
        instanceId: 1,
        cfs: [
          { cfId: 10, cfName: "HDR" },
          { cfId: 11, cfName: "Atmos" },
        ],
      }),
      ctxNone,
    );
    expect(res.status).toBe(200);
    expect(await prisma.cfPreference.count({ where: { instanceId: 1 } })).toBe(
      2,
    );
  });

  test("empty cfs[] clears existing preferences", async () => {
    await PUT(
      putReq({ instanceId: 1, cfs: [{ cfId: 10, cfName: "HDR" }] }),
      ctxNone,
    );
    await PUT(putReq({ instanceId: 1, cfs: [] }), ctxNone);
    expect(await prisma.cfPreference.count({ where: { instanceId: 1 } })).toBe(
      0,
    );
  });

  test("schema-failing body returns 400", async () => {
    const res = await PUT(putReq({ instanceId: 0, cfs: [] }), ctxNone);
    expect(res.status).toBe(400);
  });

  test("malformed JSON returns 400", async () => {
    const req = new NextRequest("http://localhost/api/preferences", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: "not-json",
    });
    const res = await PUT(req, ctxNone);
    expect(res.status).toBe(400);
  });
});

describe("GET /api/preferences", () => {
  test("returns only the requested instance's preferences", async () => {
    await PUT(
      putReq({ instanceId: 1, cfs: [{ cfId: 10, cfName: "HDR" }] }),
      ctxNone,
    );
    await PUT(
      putReq({ instanceId: 2, cfs: [{ cfId: 20, cfName: "DV" }] }),
      ctxNone,
    );
    const res = await GET(getReq("instanceId=1"), ctxNone);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].cfName).toBe("HDR");
  });

  test("missing instanceId query returns 400", async () => {
    const res = await GET(getReq(""), ctxNone);
    expect(res.status).toBe(400);
  });
});
