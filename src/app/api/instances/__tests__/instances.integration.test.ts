import { describe, test, expect } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/instances/route";
import { GET as getOne, PUT, DELETE } from "@/app/api/instances/[id]/route";
import { prisma } from "@/server/lib/db";
import { isEncrypted } from "@/server/lib/crypto";
import { dataCache } from "@/server/lib/DataCache";

const ctxFor = (id: number) => ({ params: Promise.resolve({ id: String(id) }) });

function postReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/instances", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
function putReq(id: number, body: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/instances/${id}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
function getReq() {
  return new NextRequest("http://localhost/api/instances", { method: "GET" });
}
function delReq(id: number) {
  return new NextRequest(`http://localhost/api/instances/${id}`, { method: "DELETE" });
}

const valid = {
  type: "radarr" as const,
  name: "My Radarr",
  url: "http://192.168.1.10:7878",
  apiKey: "abcd1234abcd1234abcd1234abcd1234",
};

describe("GET /api/instances", () => {
  test("empty list when no instances exist", async () => {
    const res = await GET(getReq(), { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  test("returns InstanceListItem[] without apiKey", async () => {
    await POST(postReq(valid), { params: Promise.resolve({}) });
    const res = await GET(getReq(), { params: Promise.resolve({}) });
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0]).not.toHaveProperty("apiKey");
    expect(body[0]).toHaveProperty("name", "My Radarr");
  });
});

describe("POST /api/instances", () => {
  test("valid Radarr URL → 201, response has no apiKey, DB row is encrypted", async () => {
    const res = await POST(postReq(valid), { params: Promise.resolve({}) });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).not.toHaveProperty("apiKey");

    const raw = await prisma.instance.findUnique({ where: { id: body.id } });
    expect(isEncrypted(raw!.apiKey)).toBe(true);
    expect(raw!.apiKey).not.toBe(valid.apiKey);
  });

  test("rejects AWS metadata URL (SSRF guard) with 400", async () => {
    const res = await POST(postReq({ ...valid, url: "http://169.254.169.254/" }), { params: Promise.resolve({}) });
    expect(res.status).toBe(400);
  });

  test("rejects ftp:// scheme with 400", async () => {
    const res = await POST(postReq({ ...valid, url: "ftp://example.com/" }), { params: Promise.resolve({}) });
    expect(res.status).toBe(400);
  });

  test("accepts an RFC1918 LAN URL", async () => {
    const res = await POST(postReq({ ...valid, url: "http://10.0.0.5:7878" }), { params: Promise.resolve({}) });
    expect(res.status).toBe(201);
  });

  test("rejects schema-failing payload with 400", async () => {
    const res = await POST(postReq({ type: "plex", name: "X" }), { params: Promise.resolve({}) });
    expect(res.status).toBe(400);
  });

  test("rejects malformed JSON with 400", async () => {
    const req = new NextRequest("http://localhost/api/instances", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json{",
    });
    const res = await POST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(400);
  });
});

describe("GET / PUT / DELETE /api/instances/[id]", () => {
  test("getOne returns the instance without apiKey", async () => {
    const created = await POST(postReq(valid), { params: Promise.resolve({}) });
    const { id } = await created.json();
    const res = await getOne(new NextRequest(`http://localhost/api/instances/${id}`), ctxFor(id));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).not.toHaveProperty("apiKey");
  });

  test("getOne with unknown id returns 404", async () => {
    const res = await getOne(new NextRequest("http://localhost/api/instances/99999"), ctxFor(99999));
    expect(res.status).toBe(404);
  });

  test("PUT updates fields and re-encrypts a new apiKey", async () => {
    const created = await POST(postReq(valid), { params: Promise.resolve({}) });
    const { id } = await created.json();
    const res = await PUT(putReq(id, { name: "Renamed", apiKey: "newkeynewkeynewkeynewkeynewkey00" }), ctxFor(id));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("Renamed");
    const raw = await prisma.instance.findUnique({ where: { id } });
    expect(isEncrypted(raw!.apiKey)).toBe(true);
  });

  test("PUT rejects unsafe URL with 400", async () => {
    const created = await POST(postReq(valid), { params: Promise.resolve({}) });
    const { id } = await created.json();
    const res = await PUT(putReq(id, { url: "http://169.254.169.254/" }), ctxFor(id));
    expect(res.status).toBe(400);
  });

  test("DELETE removes the row", async () => {
    const created = await POST(postReq(valid), { params: Promise.resolve({}) });
    const { id } = await created.json();
    const res = await DELETE(delReq(id), ctxFor(id));
    expect(res.status).toBe(200);
    expect(await prisma.instance.findUnique({ where: { id } })).toBeNull();
  });

  test("PUT invalidates that instance's flagged-media cache", async () => {
    const created = await POST(postReq(valid), { params: Promise.resolve({}) });
    const { id } = await created.json();
    dataCache.set(`movies:${id}:manual`, ["stale"]);
    dataCache.set(`series:${id}:profile`, ["stale"]);
    dataCache.set(`movies:9999:manual`, ["other"]);

    const res = await PUT(putReq(id, { name: "Renamed" }), ctxFor(id));
    expect(res.status).toBe(200);
    expect(dataCache.get(`movies:${id}:manual`, 60_000)).toBeNull();
    expect(dataCache.get(`series:${id}:profile`, 60_000)).toBeNull();
    expect(dataCache.get(`movies:9999:manual`, 60_000)).toEqual(["other"]);
  });

  test("DELETE invalidates that instance's flagged-media cache", async () => {
    const created = await POST(postReq(valid), { params: Promise.resolve({}) });
    const { id } = await created.json();
    dataCache.set(`movies:${id}:manual`, ["stale"]);
    dataCache.set(`movies:9999:manual`, ["other"]);

    const res = await DELETE(delReq(id), ctxFor(id));
    expect(res.status).toBe(200);
    expect(dataCache.get(`movies:${id}:manual`, 60_000)).toBeNull();
    expect(dataCache.get(`movies:9999:manual`, 60_000)).toEqual(["other"]);
  });
});
