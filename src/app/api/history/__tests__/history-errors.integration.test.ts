import { describe, test, expect } from "vitest";
import { NextRequest } from "next/server";
import { logRepository } from "@/server/repositories/LogRepository";
import { GET } from "@/app/api/history/errors/route";

const ctx = { params: Promise.resolve({}) };

function req(qs: string) {
  return new NextRequest(`http://localhost/api/history/errors?${qs}`, {
    method: "GET",
  });
}

const baseFailed = {
  instanceId: 1,
  action: "search" as const,
  mediaId: 1,
  title: "x",
  isDryRun: false,
  status: "failed" as const,
  error: "boom",
  payload: null,
};

describe("GET /api/history/errors instanceId validation", () => {
  test("missing instanceId → 400", async () => {
    const res = await GET(req(""), ctx);
    expect(res.status).toBe(400);
  });

  test("non-numeric instanceId → 400", async () => {
    const res = await GET(req("instanceId=abc"), ctx);
    expect(res.status).toBe(400);
  });

  test("zero instanceId → 400", async () => {
    const res = await GET(req("instanceId=0"), ctx);
    expect(res.status).toBe(400);
  });

  test("negative instanceId → 400", async () => {
    const res = await GET(req("instanceId=-1"), ctx);
    expect(res.status).toBe(400);
  });

  test("valid positive instanceId → 200 with array", async () => {
    await logRepository.create({ ...baseFailed, mediaId: 1 });
    await logRepository.create({ ...baseFailed, mediaId: 2 });
    const res = await GET(req("instanceId=1"), ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });
});
