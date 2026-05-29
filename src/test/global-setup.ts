import { randomBytes } from "crypto";
import { execSync } from "child_process";
import { existsSync, mkdirSync, readdirSync, rmSync } from "fs";
import { join } from "path";

const LOCAL_DIR = "./local";
const TEMPLATE_DB = `${LOCAL_DIR}/vitest-template.db`;

export function setup() {
  process.env.ENCRYPTION_KEY = randomBytes(32).toString("base64");
  (process.env as Record<string, string>).NODE_ENV = "test";
  process.env.LOG_LEVEL = "silent";
  // Tight retention caps so tests can exercise the trim overflow path quickly.
  process.env.LOG_RETENTION_CAP = "5";
  process.env.ACTION_LOG_RETENTION_CAP = "5";
  process.env.SEARCH_QUEUE_RETENTION_CAP = "5";

  mkdirSync(LOCAL_DIR, { recursive: true });

  // Wipe the template plus any leftover worker DBs from the previous run
  // (vitest-test-N.db) and the legacy single-DB file (vitest-test.db) so
  // migrations apply cleanly against an empty SQLite each invocation.
  for (const entry of readdirSync(LOCAL_DIR)) {
    const isTemplate =
      entry === "vitest-template.db" || entry.startsWith("vitest-template.db-");
    const isWorker =
      entry.startsWith("vitest-test-") || entry === "vitest-test.db";
    if (isTemplate || isWorker) {
      rmSync(join(LOCAL_DIR, entry), { force: true });
    }
  }

  // Migrate the template once. Each worker copies it into its own DB on
  // first setup so the migrations don't re-run N times.
  const templateUrl = `file:${TEMPLATE_DB}`;
  process.env.DATABASE_URL = templateUrl;
  execSync("yarn prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: templateUrl },
    stdio: "inherit",
  });

  if (!existsSync(TEMPLATE_DB)) {
    throw new Error(`Template DB not created at ${TEMPLATE_DB}`);
  }
}

export function teardown() {}
