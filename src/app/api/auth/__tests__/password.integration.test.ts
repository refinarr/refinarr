import { describe, test, expect } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/db";
import {
  hashPassword,
  verifyPassword,
  createSession,
  SESSION_COOKIE,
} from "@/server/lib/auth";
import { userRepository } from "@/server/repositories/UserRepository";
import { POST } from "@/app/api/auth/password/route";

const CURRENT = "current-password-123";

async function seedUserSession() {
  const user = await userRepository.create({
    username: "pwuser",
    passwordHash: hashPassword(CURRENT),
  });
  const session = await createSession(user.id);
  return { user, session };
}

function makeReq(body: unknown, sessionId: string, ip = "9.9.9.1") {
  return new NextRequest("http://localhost/api/auth/password", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": ip,
      cookie: `${SESSION_COOKIE}=${sessionId}`,
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/password", () => {
  // BUG (QA #19): the API used to ignore confirmPassword, so a non-UI caller
  // could change the password to an unconfirmed value and lock the user out.
  test("rejects a mismatched confirmPassword with 400 and leaves the password unchanged", async () => {
    const { user, session } = await seedUserSession();
    const res = await POST(
      makeReq(
        {
          currentPassword: CURRENT,
          newPassword: "brand-new-pass-123",
          confirmPassword: "different-pass-456",
        },
        session.id,
      ),
    );
    expect(res.status).toBe(400);
    const after = await prisma.user.findUnique({ where: { id: user.id } });
    expect(verifyPassword(CURRENT, after!.passwordHash)).toBe(true);
  });

  test("rejects a missing confirmPassword with 400", async () => {
    const { session } = await seedUserSession();
    const res = await POST(
      makeReq(
        { currentPassword: CURRENT, newPassword: "brand-new-pass-123" },
        session.id,
        "9.9.9.2",
      ),
    );
    expect(res.status).toBe(400);
  });

  test("changes the password when confirmPassword matches", async () => {
    const { user, session } = await seedUserSession();
    const NEW = "brand-new-pass-123";
    const res = await POST(
      makeReq(
        { currentPassword: CURRENT, newPassword: NEW, confirmPassword: NEW },
        session.id,
        "9.9.9.3",
      ),
    );
    expect(res.status).toBe(200);
    const after = await prisma.user.findUnique({ where: { id: user.id } });
    expect(verifyPassword(NEW, after!.passwordHash)).toBe(true);
  });
});
