import { afterEach, describe, expect, test } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/config/api-key/route";
import { POST as setup } from "@/app/api/auth/setup/route";

async function seedUser(): Promise<void> {
  await setup(
    new NextRequest("http://localhost/api/auth/setup", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": crypto.randomUUID(),
      },
      body: JSON.stringify({ username: "admin", password: "TestPassword123!" }),
    }),
  );
}

afterEach(() => {
  delete process.env.TRUST_PROXY_AUTH;
  delete process.env.PROXY_USER_HEADER;
});

describe("POST /api/config/api-key", () => {
  test("does not bypass password re-auth in proxy mode", async () => {
    await seedUser();
    process.env.TRUST_PROXY_AUTH = "true";
    const res = await POST(
      new NextRequest("http://localhost/api/config/api-key", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": crypto.randomUUID(),
          "X-Remote-User": "admin",
        },
        body: JSON.stringify({ password: "WrongPassword123!" }),
      }),
    );
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toMatchObject({
      error: "Invalid password",
      code: "WRONG_PASSWORD",
    });
  });
});
