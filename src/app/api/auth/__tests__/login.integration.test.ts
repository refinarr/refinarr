import { describe, test, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as setup } from "@/app/api/auth/setup/route";
import { prisma } from "@/server/lib/db";
import { SESSION_COOKIE } from "@/server/lib/auth";

function loginReq(body: unknown, ip = "1.1.1.1"): NextRequest {
  return new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

const creds = { username: "loginuser", password: "TestPassword123!" };

beforeEach(async () => {
  // Each test starts with a single admin user.
  const setupReq = new NextRequest("http://localhost/api/auth/setup", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "0.0.0.1",
    },
    body: JSON.stringify(creds),
  });
  await setup(setupReq);
});

describe("POST /api/auth/login", () => {
  test("valid credentials → 200 + session cookie", async () => {
    const res = await login(loginReq(creds));
    expect(res.status).toBe(200);
    const cookie = res.cookies.get(SESSION_COOKIE);
    expect(cookie?.value).toMatch(/^[a-f0-9]{64}$/);
    const session = await prisma.session.findUnique({
      where: { id: cookie!.value },
    });
    expect(session).not.toBeNull();
  });

  test("wrong password → 401, no cookie", async () => {
    const res = await login(
      loginReq({ username: creds.username, password: "WrongPassword123!" }),
    );
    expect(res.status).toBe(401);
    expect(res.cookies.get(SESSION_COOKIE)).toBeUndefined();
  });

  test("non-existent username → 401 with same shape (no enumeration)", async () => {
    const res = await login(
      loginReq({ username: "nobody", password: "TestPassword123!" }),
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Invalid credentials");
  });

  test("malformed JSON → 400", async () => {
    const req = new NextRequest("http://localhost/api/auth/login", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "1.2.3.4",
      },
      body: "not-json{",
    });
    const res = await login(req);
    expect(res.status).toBe(400);
  });

  test("schema-failing body → 400", async () => {
    const res = await login(loginReq({ username: "x", password: "short" }));
    expect(res.status).toBe(400);
  });

  test("11th attempt from same IP → 429", async () => {
    const ip = "9.9.9.9";
    for (let i = 0; i < 10; i += 1) {
      await login(
        loginReq(
          { username: creds.username, password: "WrongPassword123!" },
          ip,
        ),
      );
    }
    const res = await login(loginReq(creds, ip));
    expect(res.status).toBe(429);
  });
});
