import { mkdir, rm, writeFile } from "fs/promises";
import { execSync } from "child_process";
import { randomBytes, scryptSync } from "crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { E2E_USERNAME, E2E_PASSWORD } from "./helpers";

const SESSION_COOKIE = "rfn_session";
const SESSION_DAYS = 30;

function hashPassword(password: string): string {
  const N = 16384;
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64, { N, r: 8, p: 1 });
  return `scrypt$${N}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export default async function globalSetup() {
  // Wipe the E2E test DB + encryption key so every run starts fresh.
  await mkdir("local", { recursive: true });

  for (const f of [
    "local/e2e-test.db",
    "local/e2e-test.db-journal",
    "local/e2e-test.db-wal",
    "local/e2e-test.db-shm",
    "local/.encryption-key.e2e",
  ]) {
    await rm(f, { force: true });
  }

  // Apply schema to the fresh DB before the webServer starts.
  execSync("yarn prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: "file:./local/e2e-test.db" },
    stdio: "inherit",
  });

  // Seed the E2E admin account + an active session, then write the storageState
  // file so all spec files can start authenticated. Bypasses the /setup UI flow.
  const prisma = new PrismaClient({
    adapter: new PrismaLibSql({ url: "file:./local/e2e-test.db" }),
  });
  let sessionId: string;
  let expiresAt: Date;
  try {
    const user = await prisma.user.create({
      data: {
        username: E2E_USERNAME,
        passwordHash: hashPassword(E2E_PASSWORD),
      },
    });
    sessionId = randomBytes(32).toString("hex");
    expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
    await prisma.session.create({
      data: { id: sessionId, userId: user.id, expiresAt },
    });
  } finally {
    await prisma.$disconnect();
  }

  await mkdir("e2e/.auth", { recursive: true });
  await writeFile(
    "e2e/.auth/user.json",
    JSON.stringify({
      cookies: [
        {
          name: SESSION_COOKIE,
          value: sessionId,
          domain: "localhost",
          path: "/",
          expires: expiresAt.getTime() / 1000,
          httpOnly: true,
          secure: false,
          sameSite: "Strict",
        },
      ],
      origins: [],
    }),
  );
}
