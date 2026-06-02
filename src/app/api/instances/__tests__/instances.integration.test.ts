import { describe, test, expect } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/db";
import { isEncrypted } from "@/server/lib/crypto";
import { dataCache } from "@/server/lib/data-cache";
import { GET as getOne, PUT, DELETE } from "@/app/api/instances/[id]/route";
import { GET, POST } from "@/app/api/instances/route";

const ctxFor = (id: number) => ({
  params: Promise.resolve({ id: String(id) }),
});

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
  return new NextRequest(`http://localhost/api/instances/${id}`, {
    method: "DELETE",
  });
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

  test("returns PublicInstance[] without apiKey", async () => {
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
    const res = await POST(
      postReq({ ...valid, url: "http://169.254.169.254/" }),
      { params: Promise.resolve({}) },
    );
    expect(res.status).toBe(400);
  });

  test("rejects ftp:// scheme with 400", async () => {
    const res = await POST(postReq({ ...valid, url: "ftp://example.com/" }), {
      params: Promise.resolve({}),
    });
    expect(res.status).toBe(400);
  });

  test("accepts an RFC1918 LAN URL", async () => {
    const res = await POST(postReq({ ...valid, url: "http://10.0.0.5:7878" }), {
      params: Promise.resolve({}),
    });
    expect(res.status).toBe(201);
  });

  test("rejects schema-failing payload with 400", async () => {
    const res = await POST(postReq({ type: "plex", name: "X" }), {
      params: Promise.resolve({}),
    });
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
    const res = await getOne(
      new NextRequest(`http://localhost/api/instances/${id}`),
      ctxFor(id),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).not.toHaveProperty("apiKey");
  });

  test("getOne with unknown id returns 404", async () => {
    const res = await getOne(
      new NextRequest("http://localhost/api/instances/99999"),
      ctxFor(99999),
    );
    expect(res.status).toBe(404);
  });

  test("PUT on unknown id returns 404, not 500 (#22)", async () => {
    const res = await PUT(putReq(99999, { name: "Ghost" }), ctxFor(99999));
    expect(res.status).toBe(404);
  });

  test("DELETE on unknown id returns 404, not 500 (#22)", async () => {
    const res = await DELETE(delReq(99999), ctxFor(99999));
    expect(res.status).toBe(404);
  });

  test("PUT updates fields and re-encrypts a new apiKey", async () => {
    const created = await POST(postReq(valid), { params: Promise.resolve({}) });
    const { id } = await created.json();
    const res = await PUT(
      putReq(id, {
        name: "Renamed",
        apiKey: "newkeynewkeynewkeynewkeynewkey00",
      }),
      ctxFor(id),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("Renamed");
    const raw = await prisma.instance.findUnique({ where: { id } });
    expect(isEncrypted(raw!.apiKey)).toBe(true);
  });

  test("PUT rejects unsafe URL with 400", async () => {
    const created = await POST(postReq(valid), { params: Promise.resolve({}) });
    const { id } = await created.json();
    const res = await PUT(
      putReq(id, { url: "http://169.254.169.254/" }),
      ctxFor(id),
    );
    expect(res.status).toBe(400);
  });

  test("PUT silently drops `type` field — instance.type is immutable", async () => {
    // Pending SearchQueue rows resolve arr-type at drain time from the
    // live instance, so a Radarr↔Sonarr swap would strand sonarr-action
    // rows on a now-Radarr instance and fail them at dispatch. The
    // update schema omits `type`; zod's default object drops unknown
    // keys, so the request succeeds with the field ignored. Delete +
    // recreate is the intended path for arr-type changes.
    const created = await POST(postReq(valid), { params: Promise.resolve({}) });
    const { id, type } = await created.json();
    const otherType = type === "radarr" ? "sonarr" : "radarr";
    const res = await PUT(putReq(id, { type: otherType }), ctxFor(id));
    expect(res.status).toBe(200);
    const after = await prisma.instance.findUnique({ where: { id } });
    expect(after?.type).toBe(type); // ← unchanged: the guarantee that matters
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
    dataCache.set(`movies:${id}`, ["stale"]);
    dataCache.set(`series:${id}`, ["stale"]);
    // Descendant key (extra trailing segment) must also drop; a
    // prefix-collision key (`movies:${id}0`) must survive — invalidate
    // anchors on the instanceId segment, not a substring.
    dataCache.set(`movies:${id}:details`, ["child"]);
    dataCache.set(`movies:${id}0`, ["collision"]);
    dataCache.set(`movies:9999`, ["other"]);

    const res = await PUT(putReq(id, { name: "Renamed" }), ctxFor(id));
    expect(res.status).toBe(200);
    expect(dataCache.get(`movies:${id}`, 60_000)).toBeNull();
    expect(dataCache.get(`series:${id}`, 60_000)).toBeNull();
    expect(dataCache.get(`movies:${id}:details`, 60_000)).toBeNull();
    expect(dataCache.get(`movies:${id}0`, 60_000)).toEqual(["collision"]);
    expect(dataCache.get(`movies:9999`, 60_000)).toEqual(["other"]);
  });

  test("DELETE invalidates that instance's flagged-media cache", async () => {
    const created = await POST(postReq(valid), { params: Promise.resolve({}) });
    const { id } = await created.json();
    dataCache.set(`movies:${id}`, ["stale"]);
    dataCache.set(`movies:9999`, ["other"]);

    const res = await DELETE(delReq(id), ctxFor(id));
    expect(res.status).toBe(200);
    expect(dataCache.get(`movies:${id}`, 60_000)).toBeNull();
    expect(dataCache.get(`movies:9999`, 60_000)).toEqual(["other"]);
  });
});

describe("POST /api/instances — auto-search fields", () => {
  test("auto-search defaults applied when fields omitted", async () => {
    const res = await POST(postReq(valid), { params: Promise.resolve({}) });
    const body = await res.json();
    expect(body.autoSearchEnabled).toBe(false);
    expect(body.autoSearchScheduleMode).toBe("interval");
    expect(body.autoSearchIntervalMinutes).toBe(1440);
    expect(body.autoSearchBatchLimit).toBe(5);
    expect(body.autoSearchMonitoredOnly).toBe(true);
    expect(body.autoSearchScope).toBe("flagged");
  });

  test("auto-search fields persisted when provided", async () => {
    const res = await POST(
      postReq({
        ...valid,
        autoSearchEnabled: true,
        autoSearchScheduleMode: "interval",
        autoSearchIntervalMinutes: 60,
        autoSearchBatchLimit: 3,
        autoSearchMonitoredOnly: false,
        autoSearchScope: "missing",
      }),
      { params: Promise.resolve({}) },
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.autoSearchEnabled).toBe(true);
    expect(body.autoSearchIntervalMinutes).toBe(60);
    expect(body.autoSearchBatchLimit).toBe(3);
    expect(body.autoSearchScope).toBe("missing");
  });

  test("invalid cron expression returns 400 (rejected by schema, #23)", async () => {
    const res = await POST(
      postReq({
        ...valid,
        autoSearchScheduleMode: "cron",
        autoSearchCronExpression: "not a cron",
      }),
      { params: Promise.resolve({}) },
    );
    expect(res.status).toBe(400);
  });

  test("valid cron expression is accepted", async () => {
    const res = await POST(
      postReq({
        ...valid,
        autoSearchScheduleMode: "cron",
        autoSearchCronExpression: "0 3 * * *",
      }),
      { params: Promise.resolve({}) },
    );
    expect(res.status).toBe(201);
  });
});

describe("PUT /api/instances/[id] — auto-search fields", () => {
  test("can update auto-search batch limit via PUT", async () => {
    const created = await POST(postReq(valid), { params: Promise.resolve({}) });
    const { id } = await created.json();
    const res = await PUT(putReq(id, { autoSearchBatchLimit: 10 }), ctxFor(id));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.autoSearchBatchLimit).toBe(10);
  });

  test("PUT with invalid cron returns 400 (rejected by schema, #23)", async () => {
    const created = await POST(postReq(valid), { params: Promise.resolve({}) });
    const { id } = await created.json();
    const res = await PUT(
      putReq(id, {
        autoSearchScheduleMode: "cron",
        autoSearchCronExpression: "bad cron",
      }),
      ctxFor(id),
    );
    expect(res.status).toBe(400);
  });

  test("PUT with only an invalid cron field (no scheduleMode) is rejected (#23)", async () => {
    const created = await POST(postReq(valid), { params: Promise.resolve({}) });
    const { id } = await created.json();
    const res = await PUT(
      putReq(id, { autoSearchCronExpression: "garbage_string" }),
      ctxFor(id),
    );
    expect(res.status).toBe(400);
  });
});
