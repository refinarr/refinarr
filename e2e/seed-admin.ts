// E2E preflight seed. Runs SEQUENTIALLY inside playwright's webServer
// command (before `next start`), NOT in Playwright's globalSetup hook —
// which runs concurrently with webServer startup. The concurrent
// variant raced the webServer's first Prisma connection: globalSetup
// wrote the admin row, but the webServer's connection (opened before
// the write) couldn't see it because the better-sqlite3 + delete-mode
// combo uses mmap'd pages with no cross-process invalidation. Doing
// the seed inline guarantees the row is on disk before any Prisma
// adapter from a different process opens the file.
//
// Also sets WAL mode explicitly so the file header carries it forward
// for every subsequent open (the webServer's db.ts does the same — both
// paths set it for safety; PRAGMA is idempotent).
import { mkdir, writeFile } from "node:fs/promises";
import { randomBytes, scryptSync } from "node:crypto";

import BetterSqlite3 from "better-sqlite3";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";
import { E2E_DB } from "./constants.ts";
import { E2E_PASSWORD, E2E_USERNAME } from "./helpers.ts";

const SESSION_COOKIE = "rfn_session";
const SESSION_DAYS = 30;

function hashPassword(password: string): string {
  const N = 16384;
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64, { N, r: 8, p: 1 });
  return `scrypt$${N}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

function ensureWalMode(dbUrl: string): void {
  const filePath = dbUrl.replace(/^file:/, "");
  const db = new BetterSqlite3(filePath);
  try {
    db.pragma("journal_mode = WAL");
    db.pragma("synchronous = NORMAL");
  } finally {
    db.close();
  }
}

async function main(): Promise<void> {
  // DB wipe + migrate runs in the shell chain BEFORE this script.
  // Set WAL on the freshly-migrated file so the upcoming webServer
  // open inherits it.
  ensureWalMode(E2E_DB);

  const prisma = new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: E2E_DB }),
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

main().catch((err) => {
  console.error("[seed-admin] failed:", err);
  process.exit(1);
});
