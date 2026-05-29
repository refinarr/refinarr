import BetterSqlite3 from "better-sqlite3";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

// SQLite + better-sqlite3 defaults to rollback-journal mode, which
// has a documented cross-process visibility problem: each connection
// uses mmap-backed page reads and there's no shared-memory
// coordinator to invalidate stale pages when another process commits.
// Manifested as the e2e auth-test failures — globalSetup wrote a row
// from one process, but the webServer's Prisma client (started
// before the write) couldn't see it until reconnect.
//
// WAL mode fixes this by routing writes through `.db-wal` with
// `.db-shm` as the cross-connection coordinator. Setting `journal_mode
// = WAL` persists in the file header, so every subsequent open
// (Prisma adapter, separate scripts, etc.) sees WAL.
//
// We do it via a direct `better-sqlite3` Database that we open + close
// synchronously BEFORE any Prisma adapter touches the file — running
// it as a Prisma `$executeRawUnsafe` would race the first real query.
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

function createPrismaClient(): PrismaClient {
  const dbUrl =
    process.env.DATABASE_URL ??
    (process.env.NODE_ENV === "production"
      ? "file:///data/data.db"
      : "file:./dev.db");

  ensureWalMode(dbUrl);
  const adapter = new PrismaBetterSqlite3({ url: dbUrl });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function getPrismaClient(): PrismaClient {
  globalForPrisma.prisma ??= createPrismaClient();
  return globalForPrisma.prisma;
}

// `prisma` is a lazy proxy: createPrismaClient() — and its synchronous WAL
// open of the SQLite file — runs on first *use*, not when this module is
// imported. `next build` imports server modules to collect page data but
// never queries, so the DB file is never opened at build time (where there
// is no DATABASE_URL and the prod `/data` dir does not exist).
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrismaClient();
    const value = Reflect.get(client, prop);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
