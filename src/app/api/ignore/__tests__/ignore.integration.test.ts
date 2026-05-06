import { describe, test, expect } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/db";
import { GET, POST } from "@/app/api/ignore/route";
import { DELETE } from "@/app/api/ignore/[id]/route";

const ctxNone = { params: Promise.resolve({}) };
const ctxFor = (id: number) => ({
  params: Promise.resolve({ id: String(id) }),
});

function postReq(body: unknown) {
  return new NextRequest("http://localhost/api/ignore", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
function getReq(qs: string) {
  return new NextRequest(`http://localhost/api/ignore?${qs}`, {
    method: "GET",
  });
}

const validBody = {
  instanceId: 1,
  mediaId: 100,
  mediaType: "movie" as const,
  title: "Movie 100",
};

describe("POST /api/ignore", () => {
  test("creates an entry, returns 201", async () => {
    const res = await POST(postReq(validBody), ctxNone);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.title).toBe("Movie 100");
  });

  test("idempotent on (instanceId, mediaId, mediaType) — second POST returns same id", async () => {
    const a = await (await POST(postReq(validBody), ctxNone)).json();
    const b = await (
      await POST(postReq({ ...validBody, title: "Different" }), ctxNone)
    ).json();
    expect(b.id).toBe(a.id);
  });

  test("schema-failing body returns 400", async () => {
    const res = await POST(
      postReq({ instanceId: 0, mediaId: 100, mediaType: "movie", title: "X" }),
      ctxNone,
    );
    expect(res.status).toBe(400);
  });

  test("malformed JSON returns 400", async () => {
    const req = new NextRequest("http://localhost/api/ignore", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not-json",
    });
    const res = await POST(req, ctxNone);
    expect(res.status).toBe(400);
  });
});

describe("GET /api/ignore", () => {
  test("returns only entries for the requested instance", async () => {
    await POST(postReq(validBody), ctxNone);
    await POST(postReq({ ...validBody, instanceId: 2 }), ctxNone);
    const res = await GET(getReq("instanceId=1"), ctxNone);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].instanceId).toBe(1);
  });

  test("invalid instanceId returns 400", async () => {
    const res = await GET(getReq("instanceId=0"), ctxNone);
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/ignore/[id]", () => {
  test("removes the entry", async () => {
    const created = await (await POST(postReq(validBody), ctxNone)).json();
    const res = await DELETE(
      new NextRequest(`http://localhost/api/ignore/${created.id}`, {
        method: "DELETE",
      }),
      ctxFor(created.id),
    );
    expect(res.status).toBe(200);
    expect(
      await prisma.ignoreEntry.findUnique({ where: { id: created.id } }),
    ).toBeNull();
  });
});
