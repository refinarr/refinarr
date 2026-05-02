import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

const { loggerMethods } = vi.hoisted(() => ({
  loggerMethods: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    isLevelEnabled: vi.fn(),
  },
}));

vi.mock("@/server/lib/logger", () => ({
  logger: loggerMethods,
}));

import { appLogger } from "@/server/lib/app-logger";
import { prisma } from "@/server/lib/db";

beforeEach(() => {
  for (const fn of Object.values(loggerMethods)) fn.mockReset();
  loggerMethods.isLevelEnabled.mockReturnValue(true);
});

async function flushPersist() {
  // persist() schedules an async dynamic import + DB write — give the microtask
  // queue ample ticks to drain before we assert on the DB.
  for (let i = 0; i < 50; i += 1) {
    await new Promise((r) => setImmediate(r));
  }
}

afterEach(async () => {
  // Ensure any in-flight DB writes from delegation tests complete before the
  // next test's beforeEach truncates the table — prevents leaks between tests.
  await flushPersist();
  await prisma.appLog.deleteMany();
  vi.useRealTimers();
});

describe("appLogger — pino delegation", () => {
  test("info writes to pino with context", () => {
    appLogger.info("hello", { context: { a: 1 } });
    expect(loggerMethods.info).toHaveBeenCalledWith({ a: 1 }, "hello");
  });

  test("debug writes to pino", () => {
    appLogger.debug("dbg");
    expect(loggerMethods.debug).toHaveBeenCalledWith(undefined, "dbg");
  });

  test("warn writes to pino", () => {
    appLogger.warn("warn-msg", { context: { x: "y" } });
    expect(loggerMethods.warn).toHaveBeenCalledWith({ x: "y" }, "warn-msg");
  });

  test("error attaches err alongside context", () => {
    const err = new Error("boom");
    appLogger.error("oops", { context: { foo: "bar" }, err });
    expect(loggerMethods.error).toHaveBeenCalledWith({ foo: "bar", err }, "oops");
  });
});

describe("appLogger — DB persistence", () => {
  test("persists info logs as AppLog rows", async () => {
    appLogger.info("persisted-info", { source: "test", context: { k: "v" } });
    await flushPersist();
    const rows = await prisma.appLog.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].level).toBe("info");
    expect(rows[0].message).toBe("persisted-info");
    expect(rows[0].source).toBe("test");
    expect(JSON.parse(rows[0].context!)).toEqual({ k: "v" });
  });

  test("skips DB writes when the level is below the threshold", async () => {
    loggerMethods.isLevelEnabled.mockReturnValue(false);
    appLogger.info("skipped");
    await flushPersist();
    expect(await prisma.appLog.count()).toBe(0);
  });

  test("captures Error message + stack from the err field", async () => {
    const err = new Error("real-err");
    appLogger.error("oops", { err });
    await flushPersist();
    const row = await prisma.appLog.findFirst();
    expect(row).not.toBeNull();
    const ctx = JSON.parse(row!.context!);
    expect(ctx.errorMessage).toBe("real-err");
    expect(ctx.stack).toContain("real-err");
  });

  test("stringifies non-Error err values", async () => {
    appLogger.error("non-err", { err: "string-error" });
    await flushPersist();
    const row = await prisma.appLog.findFirst();
    const ctx = JSON.parse(row!.context!);
    expect(ctx.errorMessage).toBe("string-error");
  });

  test("redacts sensitive keys before writing", async () => {
    appLogger.info("redact-test", { context: { apiKey: "secret-value-here", ok: 1 } });
    await flushPersist();
    const row = await prisma.appLog.findFirst();
    const ctx = JSON.parse(row!.context!);
    expect(ctx.apiKey).toBe("***");
    expect(ctx.ok).toBe(1);
  });

  test("stores null context when no fields are provided", async () => {
    appLogger.info("no-context");
    await flushPersist();
    const row = await prisma.appLog.findFirst();
    expect(row?.context).toBeNull();
  });
});
