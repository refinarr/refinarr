import { describe, test, expect } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/auto-search/cron-preview/route";

function req(expr: string | null) {
  const url = new URL("http://localhost/api/auto-search/cron-preview");
  if (expr !== null) url.searchParams.set("expr", expr);
  return new NextRequest(url);
}

describe("GET /api/auto-search/cron-preview", () => {
  // ── Happy paths ──────────────────────────────────────────────────────────

  test("valid 5-field cron returns 200 with three ISO timestamps", async () => {
    const res = await GET(req("0 3 * * *"), { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.next)).toBe(true);
    expect(body.next).toHaveLength(3);
    for (const ts of body.next) {
      expect(ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    }
  });

  test("returned timestamps are in strictly ascending order", async () => {
    const res = await GET(req("*/30 * * * *"), { params: Promise.resolve({}) });
    const { next } = await res.json();
    const times = next.map((s: string) => new Date(s).getTime());
    expect(times[0]).toBeLessThan(times[1]);
    expect(times[1]).toBeLessThan(times[2]);
  });

  test("every-minute cron: timestamps are 60 seconds apart", async () => {
    const res = await GET(req("* * * * *"), { params: Promise.resolve({}) });
    const { next } = await res.json();
    const times = next.map((s: string) => new Date(s).getTime());
    expect(times[1] - times[0]).toBe(60_000);
    expect(times[2] - times[1]).toBe(60_000);
  });

  test("specific hour cron (0 6 * * *): each timestamp is at 06:00 local", async () => {
    const res = await GET(req("0 6 * * *"), { params: Promise.resolve({}) });
    const { next } = await res.json();
    for (const ts of next) {
      const d = new Date(ts);
      expect(d.getHours()).toBe(6);
      expect(d.getMinutes()).toBe(0);
    }
  });

  test("weekly cron (0 3 * * 1): each timestamp is on a Monday", async () => {
    const res = await GET(req("0 3 * * 1"), { params: Promise.resolve({}) });
    const { next } = await res.json();
    for (const ts of next) {
      expect(new Date(ts).getDay()).toBe(1); // 1 = Monday
    }
  });

  // ── Error paths — invalid expressions ────────────────────────────────────

  test("invalid cron returns 400 INVALID_CRON", async () => {
    const res = await GET(req("not a cron"), { params: Promise.resolve({}) });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_CRON");
  });

  test("6-field cron returns 400 INVALID_CRON (strict 5-field policy)", async () => {
    const res = await GET(req("0 0 3 * * *"), { params: Promise.resolve({}) });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_CRON");
  });

  test("empty string returns 400 INVALID_CRON", async () => {
    const res = await GET(req(""), { params: Promise.resolve({}) });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_CRON");
  });

  test("whitespace-only string returns 400 INVALID_CRON", async () => {
    const res = await GET(req("   "), { params: Promise.resolve({}) });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_CRON");
  });

  test("missing expr param returns 400 INVALID_CRON", async () => {
    const res = await GET(req(null), { params: Promise.resolve({}) });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_CRON");
  });

  test("expression with only spaces between fields returns 400", async () => {
    // Looks like 5 fields but contains junk values.
    const res = await GET(req("99 99 99 99 99"), {
      params: Promise.resolve({}),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_CRON");
  });

  test("4-field expression returns 400 INVALID_CRON", async () => {
    const res = await GET(req("0 3 * *"), { params: Promise.resolve({}) });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_CRON");
  });

  // ── Error response shape ─────────────────────────────────────────────────

  test("error response includes traceId", async () => {
    const res = await GET(req("bad"), { params: Promise.resolve({}) });
    const body = await res.json();
    expect(body).toHaveProperty("traceId");
    expect(typeof body.traceId).toBe("string");
  });

  // ── URL encoding ─────────────────────────────────────────────────────────

  test("URL-encoded cron expression is decoded correctly", async () => {
    // "0 3 * * *" URL-encoded as passed by fetch()
    const url = new URL("http://localhost/api/auto-search/cron-preview");
    url.searchParams.set("expr", "0 3 * * *"); // URLSearchParams encodes the spaces
    const res = await GET(new NextRequest(url), {
      params: Promise.resolve({}),
    });
    expect(res.status).toBe(200);
  });
});
