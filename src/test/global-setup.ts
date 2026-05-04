import { randomBytes } from "crypto";
import { execSync } from "child_process";
import { rmSync } from "fs";

const TEST_DB_PATH = "./vitest-test.db";
const TEST_DB_URL = `file:${TEST_DB_PATH}`;

export function setup() {
  process.env.ENCRYPTION_KEY = randomBytes(32).toString("base64");
  (process.env as Record<string, string>).NODE_ENV = "test";
  process.env.LOG_LEVEL = "silent";
  process.env.DATABASE_URL = TEST_DB_URL;
  // Tight retention caps so tests can exercise the trim overflow path quickly.
  process.env.LOG_RETENTION_CAP = "5";
  process.env.ACTION_LOG_RETENTION_CAP = "5";
  process.env.SEARCH_QUEUE_RETENTION_CAP = "5";

  // Wipe any leftover test DB so migrations apply cleanly.
  for (const f of [TEST_DB_PATH, `${TEST_DB_PATH}-journal`, `${TEST_DB_PATH}-wal`, `${TEST_DB_PATH}-shm`]) {
    rmSync(f, { force: true });
  }
  execSync("yarn prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: TEST_DB_URL },
    stdio: "inherit",
  });
}

export function teardown() {}
