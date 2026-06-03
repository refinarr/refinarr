import { describe, test, expect } from "vitest";
import {
  isStorageFullError,
  insufficientStorage,
} from "@/server/lib/api-errors";

describe("isStorageFullError", () => {
  test("detects the SQLite disk-full driver code", () => {
    expect(isStorageFullError({ code: "SQLITE_FULL" })).toBe(true);
  });

  test("detects the canonical SQLite message regardless of code", () => {
    expect(isStorageFullError(new Error("database or disk is full"))).toBe(
      true,
    );
    expect(isStorageFullError(new Error("SqliteError: disk is full"))).toBe(
      true,
    );
    expect(isStorageFullError(new Error("write ENOSPC"))).toBe(true);
  });

  test("ignores unrelated errors", () => {
    expect(isStorageFullError(new Error("connection refused"))).toBe(false);
    expect(isStorageFullError({ code: "P2002" })).toBe(false);
    expect(isStorageFullError(null)).toBe(false);
    expect(isStorageFullError(undefined)).toBe(false);
    expect(isStorageFullError("disk is full")).toBe(false);
  });
});

describe("insufficientStorage", () => {
  test("builds a 507 STORAGE_FULL error that exposes its message", () => {
    const err = insufficientStorage();
    expect(err.status).toBe(507);
    expect(err.code).toBe("STORAGE_FULL");
    expect(err.expose).toBe(true);
    expect(err.logLevel).toBe("warn");
    expect(err.message).toMatch(/full/i);
  });
});
