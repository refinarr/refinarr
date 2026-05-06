import { describe, test, expect } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/db";
import { SESSION_COOKIE, verifyPassword } from "@/server/lib/auth";
import { POST } from "@/app/api/auth/setup/route";

function makeReq(body: unknown, ip = "1.1.1.1"): NextRequest {
  return new NextRequest("http://localhost/api/auth/setup", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/setup", () => {
  test("creates the admin user, sets a session cookie, hashes the password", async () => {
    const res = await POST(
      makeReq({ username: "admin1", password: "TestPassword123!" }),
    );
    expect(res.status).toBe(200);

    const user = await prisma.user.findUnique({
      where: { username: "admin1" },
    });
    expect(user).not.toBeNull();
    expect(verifyPassword("TestPassword123!", user!.passwordHash)).toBe(true);

    const cookie = res.cookies.get(SESSION_COOKIE);
    expect(cookie?.value).toMatch(/^[a-f0-9]{64}$/);

    const session = await prisma.session.findUnique({
      where: { id: cookie!.value },
    });
    expect(session?.userId).toBe(user!.id);
  });

  test("second setup attempt returns 409", async () => {
    await POST(makeReq({ username: "first", password: "TestPassword123!" }));
    const res = await POST(
      makeReq({ username: "second", password: "TestPassword123!" }, "2.2.2.2"),
    );
    expect(res.status).toBe(409);
  });

  test("password shorter than 12 chars returns 400", async () => {
    const res = await POST(makeReq({ username: "admin", password: "short" }));
    expect(res.status).toBe(400);
  });

  test("malformed JSON returns 400", async () => {
    const req = new NextRequest("http://localhost/api/auth/setup", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "9.9.9.9",
      },
      body: "not-json{",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  test("invalid username characters returns 400", async () => {
    const res = await POST(
      makeReq({ username: "has spaces", password: "TestPassword123!" }),
    );
    expect(res.status).toBe(400);
  });

  test("11th attempt from same IP returns 429", async () => {
    const ip = "5.5.5.5";
    for (let i = 0; i < 10; i += 1) {
      // Each call returns 409 after the first (already-set-up), but rate-limit fires before that check.
      // Wait — rate-limit IS first, so the 11th call is the one blocked.
      await POST(
        makeReq({ username: `u${i}`, password: "TestPassword123!" }, ip),
      );
    }
    const res = await POST(
      makeReq({ username: "blocked", password: "TestPassword123!" }, ip),
    );
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toMatch(/^\d+$/);
  });
});
